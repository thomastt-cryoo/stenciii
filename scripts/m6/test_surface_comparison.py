import math, struct, unittest
from exact_surface import compare
from surface_deviation import certify

def cube(delta=0.0, alternate=False):
    v=[(0.,0.,0.),(1.,0.,0.),(1.,1.,0.),(0.,1.,0.),(0.,0.,1.+delta),(1.,0.,1.),(1.,1.,1.),(0.,1.,1.)]
    faces=[[0,2,1],[0,3,2]]
    for i in range(4):
        j=(i+1)%4;faces.extend([[i,j,j+4],[i,j+4,i+4]])
    faces+= [[4,5,7],[5,6,7]] if alternate else [[4,5,6],[4,6,7]]
    return [[v[i] for i in f] for f in faces]
def stl(faces):
    data=bytearray(80)+struct.pack('<I',len(faces))
    for a,b,c in faces:
        u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(x*x for x in n))
        data+=struct.pack('<12fH',*(x/length for x in n),*a,*b,*c,0)
    return bytes(data)

class SurfaceComparison(unittest.TestCase):
    def test_ordering_and_different_planar_triangulations_are_distinct(self):
        a=stl(cube());ordered=stl([f[1:]+f[:1] for f in reversed(cube())]);b=stl(cube(alternate=True))
        order=compare(a,ordered);self.assertEqual(order['category'],'A');self.assertFalse(order['file_bytes_equal'])
        different=compare(a,b);self.assertEqual(different['category'],'B');self.assertTrue(different['exact_surface_equal'])
        self.assertFalse(different['exact_oriented_triangles_equal'])
    def test_same_vertices_can_hide_nonplanar_surface_differences(self):
        a,b=stl(cube(2e-6)),stl(cube(2e-6,True))
        self.assertFalse(compare(a,b)['exact_surface_equal'])
        proof=certify(a,b);self.assertTrue(proof['certified']);self.assertGreater(proof['hausdorff_upper_bound_mm'],0)
        stored_height=struct.unpack('<f',struct.pack('<f',1.+2e-6))[0]
        self.assertAlmostEqual(proof['hausdorff_upper_bound_mm'],(stored_height-1.)/2.,places=18)
        self.assertFalse(certify(stl(cube(.02)),stl(cube(.02,True)))['certified'])
    def test_missing_or_reversed_faces_cannot_pass_the_surface_proof(self):
        a=stl(cube())
        for faces in [cube()[:-1],[list(reversed(f)) for f in cube()]]:
            b=stl(faces);self.assertFalse(compare(a,b)['exact_surface_equal']);self.assertFalse(certify(a,b)['certified'])

if __name__=='__main__':unittest.main()
