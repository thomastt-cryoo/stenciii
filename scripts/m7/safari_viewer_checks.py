"""Real Safari form/pointer interactions; compare rendered canvas pixels."""
import hashlib,time

def check_viewer(execute,command,session,out):
    def picture():return execute('return document.querySelector(".mesh-preview canvas").toDataURL()')
    def changed(before):
        until=time.monotonic()+30
        while time.monotonic()<until:
            current=picture()
            if current!=before:return hashlib.sha256(current.encode()).hexdigest()
            time.sleep(.1)
        raise AssertionError('Viewer controls did not change actual canvas pixels')
    def select(label,value):execute('const e=document.querySelector(".mesh-preview [aria-label=\\\""+arguments[0]+"\\\"]");if(!e)throw Error(arguments[0]);e.value=arguments[1];e.dispatchEvent(new Event("change",{bubbles:true}))',label,value)
    execute('document.querySelector(".view-options").open=true')
    before=picture();select('Camera view','top');top=changed(before)
    before=picture();select('Camera view','iso');iso=changed(before)
    before=picture();execute('document.querySelector(".mesh-preview [aria-label=Wireframe]").click()');wire=changed(before)
    execute('document.querySelector(".mesh-preview [aria-label=Wireframe]").click()')
    # Wait for the restored filled view before testing the cutaway.
    before=picture();select('Height inspection','below');select('Inspection height (mm)','0.1');cut=changed(before)
    before=picture();select('Height inspection','full');changed(before)
    execute('document.querySelector(".view-options").open=false')
    box=execute('const r=document.querySelector(".mesh-preview canvas").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}')
    before=picture();x=round(box['x']+box['w']*.35);y=round(box['y']+box['h']*.55)
    command('POST',f'/session/{session}/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerMove','duration':0,'origin':'viewport','x':x,'y':y},{'type':'pointerDown','button':0},{'type':'pointerMove','duration':400,'origin':'viewport','x':x+80,'y':y+40},{'type':'pointerUp','button':0}]}]})
    orbit=changed(before)
    return {'passed':True,'actual_canvas_changes':{'camera_top':top,'camera_iso':iso,'wireframe':wire,'height_cutaway':cut,'pointer_orbit':orbit}}
