// Isolated CI security walkthrough only. Observe the real screen with Apple's
// Vision OCR; click only a named button when the exact app's text is visible.
import Foundation
import AppKit
import Vision
import ImageIO
import CoreGraphics
let args=CommandLine.arguments
if args.count < 2 { fatalError("screenshot required") }
if args[1] == "scroll" {
 let b=CGDisplayBounds(CGMainDisplayID())
 CGEvent(mouseEventSource:nil,mouseType:.mouseMoved,mouseCursorPosition:CGPoint(x:b.width*0.72,y:b.height*0.65),mouseButton:.left)?.post(tap:.cghidEventTap)
 for _ in 0..<5 {
  CGEvent(scrollWheelEvent2Source:nil,units:.line,wheelCount:1,wheel1:-25,wheel2:0,wheel3:0)?.post(tap:.cghidEventTap)
  Thread.sleep(forTimeInterval:0.4)
 }
 print("Scrolled Privacy & Security pane only")
 exit(0)
}
guard let src=CGImageSourceCreateWithURL(URL(fileURLWithPath:args[1]) as CFURL,nil),let image=CGImageSourceCreateImageAtIndex(src,0,nil) else {fatalError("Cannot read test screenshot")}
let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.recognitionLanguages=["en-US"]
try VNImageRequestHandler(cgImage:image).perform([request])
let observations=request.results ?? []
let texts=observations.compactMap{$0.topCandidates(1).first?.string}
print(String(data:try JSONSerialization.data(withJSONObject:texts),encoding:.utf8)!)
if args.count > 3 {
 let label=args[2],guardText=args[3]
 guard texts.joined(separator:" ").localizedCaseInsensitiveContains(guardText) else {fputs("Expected app-specific text absent\n",stderr);exit(2)}
 guard let target=observations.first(where:{$0.topCandidates(1).first?.string.caseInsensitiveCompare(label) == .orderedSame}) else {fputs("Expected button absent\n",stderr);exit(3)}
 let b=CGDisplayBounds(CGMainDisplayID()),r=target.boundingBox
 let point=CGPoint(x:b.origin.x+r.midX*b.width,y:b.origin.y+(1-r.midY)*b.height)
 CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:point,mouseButton:.left)?.post(tap:.cghidEventTap)
 CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:point,mouseButton:.left)?.post(tap:.cghidEventTap)
 print("Clicked verified app-specific button: \(label)")
}
