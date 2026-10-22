export const demoFiles = [
  {
    name: "01 \u00b7 Copper geometry.gbr",
    text: "G04 GerbCraft research synthetic fixture: asymmetric transform geometry*\n%FSLAX24Y24*%\n%MOMM*%\n%ADD10R,2.0X1.0*%\n%ADD11C,1.0*%\n%ADD12C,0.6*%\n%ADD13C,0.2*%\n%LPD*%\nG01*\nD10*\nX020000Y020000D03*\nD11*\nX070000Y020000D03*\nD12*\nX030000Y060000D03*\nD13*\nX020000Y020000D02*\nX070000Y020000D01*\nX070000Y050000D01*\nM02*\n",
  },
  {
    name: "02 \u00b7 Curved tracks.gbr",
    text: "G04 GerbCraft research synthetic fixture: two circular arcs*\n%FSLAX24Y24*%\n%MOMM*%\n%ADD10C,0.250*%\n%LPD*%\nG75*\nD10*\nG01X010000Y030000D02*\nG02X030000Y050000I020000J000000D01*\nG01X070000Y010000D02*\nG03X090000Y030000I000000J020000D01*\nM02*\n",
  },
  {
    name: "03 \u00b7 Aperture details.gbr",
    text: "G04 GerbCraft research synthetic fixture: asymmetric compound macro*\n%FSLAX24Y24*%\n%MOMM*%\n%AMASYM*\n1,1,1.0,-0.8,0,0*\n1,1,0.6,0.8,0.5,0*\n21,1,2.0,0.3,0,0,0*\n%\n%ADD10ASYM*%\n%LPD*%\nG01*\nD10*\nX030000Y030000D03*\nX080000Y060000D03*\nM02*\n",
  },
];
