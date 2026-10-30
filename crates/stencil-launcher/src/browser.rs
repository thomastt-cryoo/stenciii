//! Consumer launcher. There is no WebView dependency or command interpreter.
use std::{fs::{self, File, OpenOptions}, io::{BufRead, BufReader, Read, Write}, path::{Component, Path, PathBuf}, process::{Child, Command, Stdio}, sync::{Arc, Mutex}, time::{Duration, Instant}};
use fs2::FileExt;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

struct Options { automation: bool, no_open: bool, port: Option<u16>, idle: u16, profile: Option<PathBuf> }
impl Options {
    fn parse() -> Result<Self, String> {
        let mut result=Self {automation:false,no_open:false,port:None,idle:8,profile:None};
        let mut args=std::env::args().skip(1);
        while let Some(arg)=args.next() { match arg.as_str() {
            "--automation" => result.automation=true,
            "--no-open" => result.no_open=true,
            "--port" => result.port=Some(args.next().and_then(|v| v.parse().ok()).ok_or("--port requires 0..65535")?),
            "--idle-timeout" => result.idle=args.next().and_then(|v|v.parse().ok()).filter(|v|*v<=3600).ok_or("--idle-timeout requires 0..3600 seconds")?,
            "--profile-dir" => result.profile=Some(PathBuf::from(args.next().ok_or("--profile-dir requires a directory")?)),
            _ => return Err(format!("Unknown launcher option: {arg}")),
        }}
        Ok(result)
    }
}

fn error(message: &str, automation: bool) -> ! {
    if automation { eprintln!("{}",json!({"error":message})); }
    else {
        #[cfg(any(windows,target_os="macos"))]
        rfd::MessageDialog::new().set_title("Stencil Studio could not open").set_description(message).set_level(rfd::MessageLevel::Error).show();
        #[cfg(not(any(windows,target_os="macos")))]
        eprintln!("{message}");
    }
    std::process::exit(1)
}

fn package_paths() -> Result<(PathBuf,PathBuf,PathBuf),String> {
    let executable=std::env::current_exe().map_err(|e|e.to_string())?.canonicalize().map_err(|e|e.to_string())?;
    #[cfg(target_os="macos")]
    let root=executable.parent().and_then(Path::parent).and_then(Path::parent).ok_or("The application bundle is incomplete")?.to_owned();
    #[cfg(not(target_os="macos"))]
    let root=executable.parent().ok_or("The application folder is unavailable")?.to_owned();
    #[cfg(target_os="macos")]
    let support=root.join("Contents/Resources");
    #[cfg(not(target_os="macos"))]
    let support=root.join("Studio Support");
    let backend=support.join(if cfg!(windows){"stencil.exe"}else{"stencil"});
    Ok((root,backend,support.join("package-manifest.json")))
}

fn verify_package(root:&Path, backend:&Path, manifest:&Path) -> Result<(),String> {
    let metadata=fs::metadata(manifest).map_err(|_|"The Studio Support files are missing. Extract the complete ZIP into one folder, then open Stencil Studio again.")?;
    if metadata.len()>1_048_576 {return Err("The package manifest is damaged. Extract a fresh copy of the ZIP.".into())}
    let document:Value=serde_json::from_slice(&fs::read(manifest).map_err(|e|format!("Cannot read the package manifest: {e}"))?).map_err(|_|"The package manifest is damaged. Extract a fresh copy of the ZIP.")?;
    if document["format"]!=1 {return Err("This package format is not supported. Extract a matching launcher and Studio Support folder.".into())}
    let files=document["files"].as_array().filter(|v|!v.is_empty()&&v.len()<2000).ok_or("The package file list is damaged")?;
    let mut backend_checked=false;
    for file in files {
        let relative=file["path"].as_str().ok_or("The package file list is damaged")?;
        let path=Path::new(relative);
        if path.is_absolute() || relative.contains(['\\',':']) || !path.components().all(|part|matches!(part,Component::Normal(_))) {return Err("The package contains an unsafe support-file path.".into())}
        let full=root.join(path).canonicalize().map_err(|_|format!("A required support file is missing: {relative}. Extract the entire ZIP again."))?;
        if !full.starts_with(root) {return Err("A support file points outside this package.".into())}
        let mut input=File::open(&full).map_err(|e|format!("Cannot read {relative}: {e}. Close any program locking this file and try again."))?;
        let size=input.metadata().map_err(|e|e.to_string())?.len();
        if size>134_217_728 || file["bytes"].as_u64()!=Some(size) {return Err(format!("{relative} is incomplete or damaged. Extract a fresh copy of the ZIP."))}
        let mut digest=Sha256::new(); let mut buffer=[0u8;65536];
        loop {let count=input.read(&mut buffer).map_err(|e|e.to_string())?;if count==0 {break} digest.update(&buffer[..count]);}
        let hash=format!("{:x}",digest.finalize());
        if file["sha256"].as_str()!=Some(&hash) {return Err(format!("{relative} did not pass its integrity check. Extract a fresh copy of the ZIP."))}
        if full==backend {backend_checked=true;}
    }
    if !backend_checked {return Err("The package does not include a verified Studio support program.".into())}
    Ok(())
}

fn write_json(path:&Path, value:&Value) -> Result<(),String> {
    let temporary=path.with_extension(format!("{}.tmp",std::process::id()));
    let mut file=OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|e|e.to_string())?;
    if let Err(e)=file.write_all(serde_json::to_string_pretty(value).unwrap().as_bytes()).and_then(|_|file.sync_all()) {let _=fs::remove_file(&temporary);return Err(e.to_string())}
    drop(file);
    if let Err(e)=fs::rename(&temporary,path) {let _=fs::remove_file(&temporary);return Err(e.to_string())}
    Ok(())
}

struct Hosted {child:Arc<Mutex<Child>>}
impl Drop for Hosted {
    fn drop(&mut self) {
        self.child.lock().unwrap().stdin.take();
        let until=Instant::now()+Duration::from_secs(4);
        loop {
            let mut child=self.child.lock().unwrap();
            if child.try_wait().ok().flatten().is_some() {break}
            if Instant::now()>=until {let _=child.kill();let _=child.wait();break}
            drop(child);std::thread::sleep(Duration::from_millis(40));
        }
    }
}

fn start(backend:&Path,port:u16,idle:u16,log:&Path) -> Result<(Hosted,Value),String> {
    let log=File::create(log).map_err(|e|format!("Cannot create a local startup log: {e}"))?;
    let mut command=Command::new(backend);
    command.args(["studio","--managed","--no-open","--port",&port.to_string(),"--idle-timeout",&idle.to_string()]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::from(log));
    #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
    let mut child=command.spawn().map_err(|e|format!("Studio could not start its support program: {e}. Check that the entire ZIP was extracted and its files are not locked."))?;
    let stdout=child.stdout.take().ok_or("The local startup connection is unavailable")?;
    let hosted=Hosted {child:Arc::new(Mutex::new(child))};
    let (send,receive)=std::sync::mpsc::channel();
    std::thread::spawn(move || {let mut reader=BufReader::new(stdout);let mut line=String::new();let read=reader.read_line(&mut line);let _=send.send((read,line,reader));});
    let (read,line,mut remaining)=receive.recv_timeout(Duration::from_secs(20)).map_err(|_|"Studio did not start within 20 seconds. Close other Studio windows, check your extracted files, and try again.")?;
    read.map_err(|e|e.to_string())?;
    let data:Value=serde_json::from_str(&line).map_err(|_|"The support program stopped before opening Studio. Check the local startup log and extract a fresh matching package.")?;
    let pid=hosted.child.lock().unwrap().id();
    let port=data["port"].as_u64().filter(|p|*p>0&&*p<=65535).ok_or("Studio returned an invalid local address")?;
    if data["studio"]!="stencil-studio" || data["pid"]!=pid || data["url"]!=format!("http://localhost:{port}/") {return Err("Studio returned an unexpected startup response.".into())}
    let child=hosted.child.clone();
    std::thread::spawn(move || {
        let mut buffer=[0u8;1024];while let Ok(count)=remaining.read(&mut buffer) {if count==0 {break}}
        let code=child.lock().unwrap().wait().ok().and_then(|s|s.code()).unwrap_or(1);
        // Also closes a visible launcher if all Studio tabs have closed.
        std::process::exit(code);
    });
    Ok((hosted,data))
}

#[cfg(windows)]
fn focus(pid:u32) {
    use windows_sys::{core::BOOL,Win32::{Foundation::{HWND,LPARAM},UI::WindowsAndMessaging::{EnumWindows,GetWindowThreadProcessId,SetForegroundWindow,ShowWindow,SW_RESTORE}}};
    unsafe extern "system" fn visit(window:HWND,data:LPARAM)->BOOL {let mut owner=0;GetWindowThreadProcessId(window,&mut owner);if owner==data as u32 {ShowWindow(window,SW_RESTORE);SetForegroundWindow(window);0}else{1}}
    unsafe {EnumWindows(Some(visit),pid as LPARAM);}
}
#[cfg(target_os="macos")]
fn focus(_pid:u32) {if let Ok((root,_,_))=package_paths() {let _=Command::new("/usr/bin/open").arg("-a").arg(root).spawn();}}
#[cfg(not(any(windows,target_os="macos")))]
fn focus(_pid:u32) {}

pub(super) fn run() {
    let automation=std::env::args().any(|a|a=="--automation");
    let options=Options::parse().unwrap_or_else(|e|error(&e,automation));
    let (root,backend,manifest)=package_paths().unwrap_or_else(|e|error(&e,automation));
    verify_package(&root,&backend,&manifest).unwrap_or_else(|e|error(&e,automation));
    let profile=options.profile.unwrap_or_else(||directories::ProjectDirs::from("com","Stencil Studio","Stencil Studio").map(|p|p.data_local_dir().to_path_buf()).unwrap_or_else(||error("Your local application-data folder is unavailable.",automation)));
    fs::create_dir_all(&profile).unwrap_or_else(|e|error(&format!("Studio cannot use its local settings folder: {e}. Your saved project files have not been changed."),automation));
    let lock=OpenOptions::new().read(true).write(true).create(true).truncate(false).open(profile.join("launcher.lock")).unwrap_or_else(|e|error(&format!("Studio cannot open its local settings lock: {e}"),automation));
    if lock.try_lock_exclusive().is_err() {
        if !automation {if let Ok(bytes)=fs::read(profile.join("instance.json")) {if let Ok(existing)=serde_json::from_slice::<Value>(&bytes) {if let Some(pid)=existing["launcherPid"].as_u64() {focus(pid as u32);}}}}
        if automation {println!("{}",json!({"alreadyRunning":true}));} return;
    }
    let settings=profile.join("startup.json");
    let remembered=if settings.exists() {
        let raw=fs::read(&settings).unwrap_or_else(|e|error(&format!("Cannot read Studio's startup settings: {e}"),automation));
        let data:Value=serde_json::from_slice(&raw).unwrap_or_else(|_|error("Studio's startup settings are damaged. Your project files and browser draft have not been deleted. Keep a backup of the startup.json file in Studio's local settings folder, move that file aside, then try again.",automation));
        Some(data["port"].as_u64().filter(|p|*p>0&&*p<=65535).unwrap_or_else(||error("Studio's remembered address is damaged. Preserve startup.json for recovery and move it aside before trying again.",automation)) as u16)
    } else {None};
    let requested=options.port.or(remembered).unwrap_or(5173);
    let (hosted,mut instance)=start(&backend,requested,options.idle,&profile.join("last-startup.log")).unwrap_or_else(|e|error(&e,automation));
    let actual=instance["port"].as_u64().unwrap() as u16;
    let temporary=remembered.is_some() && actual!=remembered.unwrap() && requested==remembered.unwrap();
    if remembered.is_none() {write_json(&settings,&json!({"schema":1,"port":actual})).unwrap_or_else(|e|error(&format!("Studio could not remember its local address: {e}. Your saved project files are unchanged."),automation));}
    instance["launcherPid"]=json!(std::process::id());instance["profile"]=json!(profile);instance["temporarySession"]=json!(temporary);
    write_json(&profile.join("instance.json"),&instance).unwrap_or_else(|e|error(&format!("Studio cannot record its current local session: {e}"),automation));
    if automation {
        println!("{instance}"); let _=std::io::stdout().flush();
        let child=hosted.child.clone();std::thread::spawn(move || {let mut buffer=[0u8;128];while let Ok(count)=std::io::stdin().read(&mut buffer){if count==0{break}}child.lock().unwrap().stdin.take();});
        loop {std::thread::sleep(Duration::from_secs(1));}
    }
    #[cfg(any(windows,target_os="macos"))]
    if temporary {
        let choice=rfd::MessageDialog::new().set_title("Studio's saved workspace address is busy").set_description("Another local application is using the address for your saved browser draft. You can open a temporary session and use Open Project to reopen a saved file. Your previous draft has not been deleted. To return to it, quit the other application and start Studio again.").set_buttons(rfd::MessageButtons::OkCancelCustom("Open a temporary session".into(),"Quit".into())).show();
        if choice!=rfd::MessageDialogResult::Custom("Open a temporary session".into()) {drop(hosted);return;}
    }
    let url=instance["url"].as_str().unwrap();
    if !options.no_open {if let Err(e)=open::that(url) {error(&format!("Studio is ready at {url}, but your browser could not open: {e}. Install or choose a supported browser and try again."),false)}}
    #[cfg(any(windows,target_os="macos"))]
    loop {
        let description=format!("Studio is running locally in your browser at:\n{url}\n\nKeep this small window open while you work. Closing all Studio tabs stops the launcher after a short delay. Choose Quit Studio to stop immediately. Save Project keeps a portable copy of your artwork and settings.\n\nNo internet connection is needed to process your artwork.");
        let action=rfd::MessageDialog::new().set_title("Stencil Studio — Browser Edition").set_description(description).set_buttons(rfd::MessageButtons::OkCancelCustom("Open Studio again".into(),"Quit Studio".into())).show();
        if action!=rfd::MessageDialogResult::Custom("Open Studio again".into()) {break}
        if let Err(e)=open::that(url) {error(&format!("Your browser could not open {url}: {e}"),false)}
    }
    #[cfg(not(any(windows,target_os="macos")))]
    {println!("Studio is running at {url}. Press Enter to stop.");let _=std::io::stdin().read_line(&mut String::new());}
    drop(hosted);
    drop(lock);
}
