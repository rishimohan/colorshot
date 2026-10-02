// CSS named colors, stored compactly and expanded on first use: each name (lowercase) followed by its
// hex value (uppercase, so the two never run together).
const PACKED =
  "aliceblueF0F8FFantiquewhiteFAEBD7aqua00FFFFaquamarine7FFFD4azureF0FFFFbeigeF5F5DCbisqueFFE4C4black000000" +
  "blanchedalmondFFEBCDblue0000FFblueviolet8A2BE2brownA52A2AburlywoodDEB887cadetblue5F9EA0chartreuse7FFF00" +
  "chocolateD2691EcoralFF7F50cornflowerblue6495EDcornsilkFFF8DCcrimsonDC143Ccyan00FFFFdarkblue00008B" +
  "darkcyan008B8BdarkgoldenrodB8860BdarkgrayA9A9A9darkgreen006400darkgreyA9A9A9darkkhakiBDB76B" +
  "darkmagenta8B008Bdarkolivegreen556B2FdarkorangeFF8C00darkorchid9932CCdarkred8B0000darksalmonE9967A" +
  "darkseagreen8FBC8Fdarkslateblue483D8Bdarkslategray2F4F4Fdarkslategrey2F4F4Fdarkturquoise00CED1" +
  "darkviolet9400D3deeppinkFF1493deepskyblue00BFFFdimgray696969dimgrey696969dodgerblue1E90FFfirebrickB22222" +
  "floralwhiteFFFAF0forestgreen228B22fuchsiaFF00FFgainsboroDCDCDCghostwhiteF8F8FFgoldFFD700goldenrodDAA520" +
  "gray808080green008000greenyellowADFF2Fgrey808080honeydewF0FFF0hotpinkFF69B4indianredCD5C5Cindigo4B0082" +
  "ivoryFFFFF0khakiF0E68ClavenderE6E6FAlavenderblushFFF0F5lawngreen7CFC00lemonchiffonFFFACDlightblueADD8E6" +
  "lightcoralF08080lightcyanE0FFFFlightgoldenrodyellowFAFAD2lightgrayD3D3D3lightgreen90EE90lightgreyD3D3D3" +
  "lightpinkFFB6C1lightsalmonFFA07Alightseagreen20B2AAlightskyblue87CEFAlightslategray778899" +
  "lightslategrey778899lightsteelblueB0C4DElightyellowFFFFE0lime00FF00limegreen32CD32linenFAF0E6" +
  "magentaFF00FFmaroon800000mediumaquamarine66CDAAmediumblue0000CDmediumorchidBA55D3mediumpurple9370DB" +
  "mediumseagreen3CB371mediumslateblue7B68EEmediumspringgreen00FA9Amediumturquoise48D1CC" +
  "mediumvioletredC71585midnightblue191970mintcreamF5FFFAmistyroseFFE4E1moccasinFFE4B5navajowhiteFFDEAD" +
  "navy000080oldlaceFDF5E6olive808000olivedrab6B8E23orangeFFA500orangeredFF4500orchidDA70D6" +
  "palegoldenrodEEE8AApalegreen98FB98paleturquoiseAFEEEEpalevioletredDB7093papayawhipFFEFD5peachpuffFFDAB9" +
  "peruCD853FpinkFFC0CBplumDDA0DDpowderblueB0E0E6purple800080rebeccapurple663399redFF0000rosybrownBC8F8F" +
  "royalblue4169E1saddlebrown8B4513salmonFA8072sandybrownF4A460seagreen2E8B57seashellFFF5EEsiennaA0522D" +
  "silverC0C0C0skyblue87CEEBslateblue6A5ACDslategray708090slategrey708090snowFFFAFAspringgreen00FF7F" +
  "steelblue4682B4tanD2B48Cteal008080thistleD8BFD8tomatoFF6347turquoise40E0D0violetEE82EEwheatF5DEB3" +
  "whiteFFFFFFwhitesmokeF5F5F5yellowFFFF00yellowgreen9ACD32";

let table: Map<string, string> | null = null;

export function namedColorHex(name: string): string | undefined {
  if (!table) {
    table = new Map();
    for (const [, n, hex] of PACKED.matchAll(/([a-z]+)([\dA-F]{6})/g)) table.set(n, hex.toLowerCase());
  }
  return table.get(name);
}
