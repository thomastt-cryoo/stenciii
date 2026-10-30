"""Customer Quick Start PDF; render and visually inspect before delivery."""
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Image,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
ROOT=Path(__file__).resolve().parents[2];out=ROOT/'output/pdf';out.mkdir(parents=True,exist_ok=True)
styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='Intro',fontName='Helvetica',fontSize=13,leading=19,textColor=HexColor('#434747'),spaceAfter=16));styles['BodyText'].fontName='Helvetica';styles['BodyText'].fontSize=11;styles['BodyText'].leading=16;styles['BodyText'].spaceAfter=9
styles['Heading1'].fontName='Helvetica-Bold';styles['Heading1'].fontSize=26;styles['Heading1'].leading=31;styles['Heading1'].spaceAfter=15;styles['Heading1'].textColor=HexColor('#183932')
styles['Heading2'].fontSize=14;styles['Heading2'].leading=19;styles['Heading2'].spaceBefore=12;styles['Heading2'].spaceAfter=7
styles.add(ParagraphStyle(name='Caption',fontSize=9,leading=13,textColor=HexColor('#58625f'),spaceAfter=10))
story=[]
def text(s,style='BodyText'):story.append(Paragraph(s,styles[style]))
def step(title,body):story.append(KeepTogether([Paragraph(title,styles['Heading2']),Paragraph(body,styles['BodyText'])]))
def footer(c,doc):
    c.setStrokeColor(HexColor('#d6dfdb'));c.line(44,47,551,47);c.setFont('Helvetica',9);c.setFillColor(HexColor('#58625f'));c.drawString(44,32,'STENCIL STUDIO  |  OFFLINE BROWSER EDITION');c.drawRightString(551,32,str(doc.page))
text('Start on Windows','Heading1');text('Download once. Create locally in your browser.','Intro')
text('Stencil Studio opens the complete editor in your existing browser. It does not need an account, subscription, Rust, Node, Python or a separate web server installation. Choose a supported browser already installed on your computer.')
step('1. Download and extract','Download <b>StencilStudio-Windows-x64.zip</b>. In File Explorer, right-click the ZIP and choose <b>Extract All</b>. Open the extracted folder. Keep <b>Stencil Studio.exe</b> and <b>Studio Support</b> together.')
step('2. Open Studio','Double-click <b>Stencil Studio.exe</b>. Your default browser opens Studio at a local address beginning with <b>http://localhost:</b>. The small launcher window stays open while you work.')
shot=ROOT/'docs/m7/screenshots/windows-launcher.jpg'
if shot.is_file():
    story.append(Image(str(shot),width=410,height=410*230/558));text('The Windows launcher. Quit Studio stops its local server and browser processing.','Caption')
step('3. Finish safely','Download your exports and use <b>Save Project</b> before closing. Choose <b>Quit Studio</b> in the launcher to stop immediately. Closing all Studio tabs also stops it after a short delay. Processing does not continue after quitting.')
text('The Windows launcher is unsigned. Windows may show a publisher warning for a new download. Check the trusted seller and published checksum; never disable antivirus or system security to run it. See the supplied platform record for warnings actually observed.','Caption')
story.append(PageBreak())
text('Start on Mac','Heading1');text('The Mac app is a launcher for the local browser editor.','Intro')
step('1. Choose your Mac download','Use <b>StencilStudio-macOS-Apple-Silicon.zip</b> for a Mac with an Apple M-series chip. An <b>Intel</b> download, when supplied and qualified, is for Intel Macs. Check <b>Apple menu &gt; About This Mac</b> if unsure. Use the supplied test record for exact qualified macOS and browser versions.')
step('2. Extract and open','Double-click the ZIP to extract it, then open <b>Stencil Studio.app</b>. Keep the app bundle intact. You may keep it in a normal user folder or move it to your own Applications folder. Your default browser opens the local Studio.')
step('3. If macOS blocks the app','This edition uses an ad hoc integrity signature. It is not signed with a paid Apple Developer ID and is not notarized. After checking your trusted seller and checksum, try opening it. If macOS offers the option, use <b>System Settings &gt; Privacy &amp; Security &gt; Open Anyway</b> for this app, then follow its confirmation. Do not disable Gatekeeper globally.')
text('Apple explains the current app-specific procedure at <link href="https://support.apple.com/en-us/102445" color="#22594b">support.apple.com/en-us/102445</link>. The exact first-download warning may vary. A working CI launch does not certify every Mac security policy.','Caption')
step('4. Work and quit','Use your installed browser to create, preview and export. Keep the small launcher window open. Save Project before closing. Quit Studio in that window stops the local server; closing all Studio tabs also stops it after a short delay.')
step('Offline use','The initial download and any browser installation need internet. After setup, artwork processing, saved project files and exports work locally. Do not open a loose index.html file; always use the supplied launcher. Browser profiles, extensions and company policies can affect local storage or downloads.')
story.append(PageBreak())
text('Create, save and return','Heading1');text('A saved project is your portable backup.','Intro')
step('1. Create your first stencil','Choose <b>Choose Image</b> or drop PNG, JPG, BMP or SVG artwork onto Studio. Choose a style, then <b>Make Stencil</b>. Adjust the size and bridge settings, inspect the stencil view, and use <b>3D</b> to orbit the result.')
step('2. Export the printable result','Use <b>Export STL</b> for a single printable model. Colour sets, tiles and hardware workflows can produce <b>Export ZIP</b>. Keep every required part together. Save batch collections and their summaries before quitting. Printing strength and fastening fit still need calibration for your own printer and materials.')
step('3. Save your project','Choose <b>Save Project</b> and keep the downloaded JSON file with your work. It includes the artwork and settings needed to reopen it. Start the launcher again and use <b>Open Project</b> to continue. Copy important files to your own backup location.')
text('The automatic browser draft belongs to that browser, its profile and the local Studio address. Private browsing, full storage or blocked storage can prevent recovery. Save Project remains the dependable way to move between Windows and Mac. If the saved address is busy, Studio explains the temporary session; use Open Project there or free the original address to return to its draft.')
step('Updates and removal','Save your work and quit Studio first. Extract an update into a new folder; keep its matching support files together. On Mac, replace the complete app bundle. Removing the application folder or app bundle leaves your separately saved projects and exports intact. Browser drafts are separate; use your browser site-data controls if you also want to erase them.')
step('If Studio will not open','Check complete extraction, the correct Mac architecture and a supported installed browser. Do not mix files from different package versions. A missing, damaged or locked support file needs a fresh full extraction or the locking program closed. If startup settings are damaged, follow the launcher message and preserve a copy before moving them aside.')
text('Each download includes Read First instructions, third-party notices and required source notices. The accompanying platform qualification record gives tested versions and known limits.','Caption')
SimpleDocTemplate(str(out/'StencilStudio-Quick-Start.pdf'),pagesize=(595.28,841.89),rightMargin=44,leftMargin=44,topMargin=47,bottomMargin=64,title='Stencil Studio - Offline Browser Quick Start',author='Stencil Studio',pageCompression=1).build(story,onFirstPage=footer,onLaterPages=footer)
print(out/'StencilStudio-Quick-Start.pdf')
