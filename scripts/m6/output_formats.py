"""Additional independent checks for generated STL normals, PNG and SVG bytes."""
import math,struct,zlib,xml.etree.ElementTree as ET

def normals(data):
    lengths=[];minimum=1.;opposed=zero=0
    for face in struct.iter_unpack('<12fH',data[84:]):
        n=face[:3];v=face[3:12];a=[v[i+3]-v[i] for i in range(3)];b=[v[i+6]-v[i] for i in range(3)]
        cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
        nl=math.sqrt(sum(x*x for x in n));cl=math.sqrt(sum(x*x for x in cross))
        if not nl or not cl:zero+=1;continue
        cosine=sum(x*y for x,y in zip(n,cross))/(nl*cl);minimum=min(minimum,cosine);opposed+=cosine<=0;lengths.append(nl)
    assert not zero and not opposed
    assert all(abs(length-1)<1e-5 for length in lengths)
    return {'finite_unit_normals':len(lengths),'zero_or_opposed_normals':zero+opposed,'minimum_normal_cross_cosine':minimum}

def png(data):
    assert data[:8]==b'\x89PNG\r\n\x1a\n';at=8;compressed=[];header=None;chunks=[]
    while at<len(data):
        length=struct.unpack_from('>I',data,at)[0];kind=data[at+4:at+8];body=data[at+8:at+8+length]
        assert len(body)==length and at+12+length<=len(data)
        assert zlib.crc32(kind+body)&0xffffffff==struct.unpack_from('>I',data,at+8+length)[0]
        if kind==b'IHDR':assert header is None;header=struct.unpack('>IIBBBBB',body)
        if kind==b'IDAT':compressed.append(body)
        chunks.append(kind.decode('ascii'));at+=12+length
        if kind==b'IEND':break
    assert at==len(data) and chunks[0]=='IHDR' and chunks[-1]=='IEND'
    width,height,depth,colour,compression,filtering,interlace=header
    assert width>0 and height>0 and compression==filtering==interlace==0
    channels={0:1,2:3,3:1,4:2,6:4}[colour];stride=(width*channels*depth+7)//8
    pixels=zlib.decompress(b''.join(compressed));assert len(pixels)==height*(stride+1)
    assert all(pixels[y*(stride+1)]<=4 for y in range(height))
    return {'width':width,'height':height,'depth':depth,'colour_type':colour,'crc_valid':True,'decoded_bytes':len(pixels)}

def svg(data):
    root=ET.fromstring(data);assert root.tag.rsplit('}',1)[-1]=='svg'
    bounds=[float(v) for v in root.attrib.get('viewBox','').replace(',',' ').split()]
    if bounds:assert len(bounds)==4 and all(map(math.isfinite,bounds)) and bounds[2]>=0 and bounds[3]>=0
    return {'well_formed':True,'viewBox':bounds,'width':root.attrib.get('width'),'height':root.attrib.get('height'),'provenance':'Actual engine artwork outlines; bridge corrections are in STL only.'}
