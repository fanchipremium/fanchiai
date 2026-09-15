import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/generate-wrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      product: {
        name: "Test",
        color_name: "Test",
        color_code: "0000",
        material: "PET",
        finish: "GLOSSY",
        swatch_image: ""
      }
    })
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
