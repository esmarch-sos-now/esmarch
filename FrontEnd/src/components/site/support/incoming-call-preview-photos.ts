// Illustrative stand-ins for scene photos, used only by the incoming-call preview (?preview=call). They are drawn
// shapes, not real photos; real requests show the photos the requester actually attached.
const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">${body}</svg>`)}`;

const street = svg(`
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec5e8"/><stop offset="1" stop-color="#e7eef5"/></linearGradient></defs>
  <rect width="640" height="640" fill="url(#sky)"/>
  <rect x="0" y="120" width="640" height="300" fill="#d9c7a8"/>
  <rect x="40" y="170" width="170" height="200" fill="#8b6b4f"/><rect x="60" y="195" width="130" height="95" fill="#bcd7e6"/>
  <rect x="250" y="150" width="350" height="230" fill="#c2553c"/><rect x="250" y="150" width="350" height="48" fill="#8e2f1f"/>
  <rect x="300" y="230" width="110" height="150" fill="#f0e2c6"/><rect x="440" y="230" width="120" height="90" fill="#bcd7e6"/>
  <rect x="0" y="380" width="640" height="260" fill="#a7a49d"/>
  <path d="M0 470H640M0 560H640M160 380V640M320 380V640M480 380V640" stroke="#8f8c85" stroke-width="3"/>
  <ellipse cx="330" cy="540" rx="150" ry="22" fill="rgba(0,0,0,.18)"/>
  <rect x="190" y="505" width="190" height="42" rx="21" fill="#3d5a80"/>
  <rect x="370" y="512" width="86" height="28" rx="14" fill="#2b2d42"/>
  <circle cx="165" cy="520" r="30" fill="#e8b88a"/><path d="M137 512q28-34 56 0" fill="#d8d8d8"/>
  <rect x="455" y="500" width="62" height="44" rx="8" fill="#6b4f2a"/>
`);

const closeUp = svg(`
  <rect width="640" height="640" fill="#b8b4ab"/>
  <path d="M0 160H640M0 320H640M0 480H640M160 0V640M320 0V640M480 0V640" stroke="#9a968d" stroke-width="4"/>
  <ellipse cx="320" cy="360" rx="250" ry="70" fill="rgba(0,0,0,.2)"/>
  <rect x="100" y="300" width="330" height="86" rx="43" fill="#3d5a80"/>
  <rect x="410" y="312" width="150" height="60" rx="30" fill="#2b2d42"/>
  <circle cx="82" cy="342" r="58" fill="#e8b88a"/><path d="M26 325q56-70 112 0" fill="#d8d8d8"/>
  <rect x="215" y="270" width="110" height="46" rx="23" fill="#e8b88a"/>
  <circle cx="500" cy="470" r="34" fill="#c2553c"/>
`);

export const previewScenePhotos = [street, closeUp];
