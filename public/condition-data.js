/* Controlled condition dataset. Photographs must be rights-cleared and grade-verified.
   Descriptions paraphrase ANDA's Australian adjectival guide; this is not ANDA certification. */
(function (root) {
  const grades = [
    ['G','Good','Heavy wear; the complete design outline remains, even if faint.',['Faint but complete design outline','Lettering and rim remaining']],
    ['VG','Very Good','Very heavy wear has flattened most raised detail. The main design remains recognisable.',['Raised detail mostly flattened','Remaining outlines and lettering']],
    ['F','Fine','Extensive wear across the design, with its outline still raised.',['Broad wear across design features','Raised outline; much fine detail lost']],
    ['VF','Very Fine','Moderate wear creates flat areas on the highest parts; much detail remains.',['Flat spots on high points','Detail retained below those points']],
    ['EF','Extremely Fine','Light wear on the high points of both sides. Some lustre may remain around lettering.',['Small areas of high-point wear','Fine detail on both sides']],
    ['aUNC','Almost Uncirculated','Only faint high-point wear separates this from an unworn coin. Original lustre often remains.',['Faint traces of wear','Weak strike can resemble wear']],
    ['UNC','Uncirculated','No wear. Strike may be weaker, with some contact marks and subdued original lustre.',['No wear on either side','Strike, contact marks and lustre']],
    ['CHU','Choice Uncirculated','No wear, a good strike, minor unobtrusive marks and at least moderate original lustre.',['Good strike and small marks','Original lustre; no wear']],
    ['GEM','Gem Uncirculated','No wear, near-perfect strike, very few tiny marks and almost full original lustre.',['Near-complete struck detail','Minute marks; almost full lustre']]
  ].map(([grade,name,description,lookFor]) => ({grade,name,description,lookFor}));
  const issues = [
    ['scratched','Scratched'],['cleaned','Cleaned'],['corrosion','Corrosion'],['toning','Toning'],
    ['edge_damage','Edge damage'],['staining','Staining'],['dented','Dented'],
    ['surface_marks','Surface marks'],['other','Other damage']
  ].map(([id,label]) => ({id,label}));
  const denominations = [['5','5c'],['10','10c'],['20','20c'],['50','50c'],['1','$1'],['2','$2']];
  const source = 'https://anda.com.au/wp-content/uploads/00114_Pt-2-Grading-Commonwealth-coins.pdf';
  // Only add grade-described photographs with a confirmed redistribution licence.
  // These are historic pre-decimal coins; they illustrate wear/grade language, not
  // the design-specific high points of current decimal coins.
  const references = [
    {grade:'G',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/9/92/Late_Roman_coin%2C_copper_alloy_nummus_of_Constantine_I%2C_good_condition_%28FindID_186628%29.jpg',
      source:'Portable Antiquities Scheme / The Trustees of the British Museum, FindID 186628',sourceUrl:'https://commons.wikimedia.org/wiki/File:Late_Roman_coin,_copper_alloy_nummus_of_Constantine_I,_good_condition_(FindID_186628).jpg',
      license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsNote:'CC BY-SA 4.0; attribute the Portable Antiquities Scheme / The Trustees of the British Museum and share adaptations under compatible terms.',
      description:'Late Roman copper-alloy nummus of Constantine I, described as good condition. A non-Australian example; use it for general wear comparison, not decimal-coin design detail.'},
    {grade:'VG',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/8/8e/Roman_silver_denarius_of_Tiberius_%28AD_14-37%29._The_coin_is_in_very_good_condition._The_obverse_shows_a_diademed_head_of_emperor_facing_right_with_inscription_TICAESARDIVI_AVGFAVR._The_reverse_shows_Liv_%28FindID_498665%29.jpg',
      source:'Portable Antiquities Scheme / The Trustees of the British Museum, FindID 498665',sourceUrl:'https://commons.wikimedia.org/wiki/File:Roman_silver_denarius_of_Tiberius_(AD_14-37)._The_coin_is_in_very_good_condition._The_obverse_shows_a_diademed_head_of_emperor_facing_right_with_inscription_TICAESARDIVI_AVGFAVR._The_reverse_shows_Liv_(FindID_498665).jpg',
      license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsNote:'CC BY-SA 4.0; attribute the Portable Antiquities Scheme / The Trustees of the British Museum and share adaptations under compatible terms.',
      description:'Roman silver denarius of Tiberius, described as very good. A non-Australian example; use it for general wear comparison, not decimal-coin design detail.'},
    {grade:'F',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/2/28/Coin_of_Helena_%28FindID_448443%29.jpg',
      source:'Portable Antiquities Scheme / The Trustees of the British Museum, FindID 448443',sourceUrl:'https://commons.wikimedia.org/wiki/File:Coin_of_Helena_(FindID_448443).jpg',
      license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsNote:'CC BY-SA 4.0; attribute the Portable Antiquities Scheme / The Trustees of the British Museum and share adaptations under compatible terms.',
      description:'Roman coin of Helena, described as fine. A non-Australian example; use it for general wear comparison, not decimal-coin design detail.'},
    {grade:'VF',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/2/2f/Roman._Coin._Nummus_AE2-3_of_Constantine_I._Reverse_view._%28FindID_447182%29.jpg',
      source:'Portable Antiquities Scheme / The Trustees of the British Museum, FindID 447182',sourceUrl:'https://commons.wikimedia.org/wiki/File:Roman._Coin._Nummus_AE2-3_of_Constantine_I._Reverse_view._(FindID_447182).jpg',
      license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsNote:'CC BY-SA 4.0; attribute the Portable Antiquities Scheme / The Trustees of the British Museum and share adaptations under compatible terms.',
      description:'Roman nummus of Constantine I, described as very fine, with slight corrosion and edge chips. Reverse-side photo only; a non-Australian wear reference, not a decimal-coin design match.'},
    {grade:'EF',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/3/38/Australian_New_Guinea_1936_Silver_Shilling.jpg',
      source:'Berlin-George, Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:Australian_New_Guinea_1936_Silver_Shilling.jpg',
      license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',
      rightsNote:'Shared under CC BY-SA 3.0; attribution and share-alike terms apply.',
      description:'Australian New Guinea 1936 shilling, described by the photographer as extremely fine. Historic sterling coin; use it to compare wear and retained detail, not as a decimal-coin design match.'},
    {grade:'EF',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/1/14/Weimar_Republik_50_Pfg_1919_D_Al-_Coin._Obverse.jpg',
      source:'Berlin-George, Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:Weimar_Republik_50_Pfg_1919_D_Al-_Coin._Obverse.jpg',
      license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsNote:'Shared under CC BY-SA 4.0; attribution and share-alike terms apply.',
      description:'Weimar Republic 50 pfennig 1919, described as extremely fine with no hidden faults. Single-side photograph; second, non-Australian EF comparison.'},
    {grade:'aUNC',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/b/b6/Florin_1951_Australian_Commonwealth_50_Years._AU_Silver_Coin.jpg',
      source:'Berlin-George, Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:Florin_1951_Australian_Commonwealth_50_Years._AU_Silver_Coin.jpg',
      license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',
      rightsNote:'Shared under CC BY-SA 3.0; attribution and share-alike terms apply.',
      description:'Australian 1951 florin, described by the photographer as almost uncirculated with much lustre. Historic pre-decimal silver coin; use it as a broad wear comparison.'}
    ,{grade:'aUNC',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/c/c1/Saxony%2C_German_State%2C_3_Mark_1913_Silver_Coin_Battle_of_Leipzig_Centennial%2C_obverse.jpg',
      source:'Berlin-George, Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:Saxony,_German_State,_3_Mark_1913_Silver_Coin_Battle_of_Leipzig_Centennial,_obverse.jpg',
      license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsNote:'Shared under CC BY-SA 4.0; attribution and share-alike terms apply.',
      description:'Saxony 3 Mark 1913, described as almost uncirculated. Second, non-Australian aUNC example; use it for broad wear comparison.'},
    {grade:'UNC',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/2/25/France_Pretender_Bronze_Coin_5_Fr_1831_Henri_V.jpg',
      source:'Berlin-George, Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:France_Pretender_Bronze_Coin_5_Fr_1831_Henri_V.jpg',
      license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsNote:'Shared under CC BY-SA 4.0; attribution and share-alike terms apply.',
      description:'France 5 francs 1831, described as uncirculated. Use it to compare unworn surfaces and strike, not as a decimal-coin design match.'},
    {grade:'CHU',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/c/c0/Guatemala_Real_1847_Silver_Coin_Fonrobert_7236.jpg',
      source:'Berlin-George, Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:Guatemala_Real_1847_Silver_Coin_Fonrobert_7236.jpg',
      license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',rightsNote:'Shared under CC BY-SA 3.0; attribution and share-alike terms apply.',
      description:'Guatemala 1 real 1847, described as choice uncirculated with attractive old toning. Close terminology match for Choice Uncirculated; broad comparison only.'},
    {grade:'GEM',denomination:null,designId:null,
      image:'https://upload.wikimedia.org/wikipedia/commons/9/9f/AH1370Moroccan5francs.jpg',
      source:'Physics-fan3.14, Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:AH1370Moroccan5francs.jpg',
      license:'CC BY-SA 2.5',licenseUrl:'https://creativecommons.org/licenses/by-sa/2.5/',rightsNote:'Shared under CC BY-SA 2.5; attribution and share-alike terms apply.',
      description:'Morocco 5 francs AH1370, described by the photographer as Gem Uncirculated. Scanned coin; broad grade comparison only.'}
  ];
  // Link to publisher-hosted examples; permission to redistribute the photographs
  // has not been established. These links are not cached photographic assets.
  const referenceSources = Object.fromEntries([
    ['G',7],['VG',6],['F',6],['VF',5],['EF',5],['aUNC',4],['UNC',4],['CHU',3],['GEM',3]
  ].map(([grade,page])=>[grade,{grade,source:'ANDA',url:`${source}#page=${page}`,page,status:'publisher_link_only'}]));
  const referenceAcquisition = [{
    grade:'UNC',denomination:'2',designId:null,
    title:'2023/2024 $2 coins — A Royal Transition',
    source:'Museums Victoria, NU 49844',
    sourceUrl:'https://collections.museumsvictoria.com.au/items/2722365',
    imageUrl:'https://collections.museumsvictoria.com.au/items/2722365/media/1944032/large',
    photographer:'Nick Crotty',license:'CC BY 4.0',
    licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
    gradeBasis:'Museum catalogue explicitly describes both coins as uncirculated; not an ANDA-certified assessment.',
    rightsBasis:'Item page identifies this photograph as Museums Victoria / CC BY 4.0 and permits reuse with attribution.',
    status:'awaiting_local_download_and_visual_review',
    limitation:'Photographed through commemorative-card windows; packaging glare may limit examination of the surfaces.'
  }];
  const legacy = Object.fromEntries(grades.flatMap(g=>[[g.grade,g.grade],[g.name,g.grade]]));
  legacy['About Uncirculated']='aUNC';
  function normalise(record = {}) {
    const hasGrade = Object.prototype.hasOwnProperty.call(record,'conditionGrade');
    const conditionGrade = hasGrade ? (grades.some(g=>g.grade===record.conditionGrade)?record.conditionGrade:null) : (legacy[record.condition]||null);
    return {...record,conditionGrade,conditionSource:'owner',conditionIssues:[...new Set((Array.isArray(record.conditionIssues)?record.conditionIssues:[]).filter(id=>issues.some(i=>i.id===id)))]};
  }
  function denominationFor(coin = {}) {
    const cents=Number(coin.denomination_cents);
    if ([5,10,20,50].includes(cents)) return String(cents);
    if (cents===100) return '1'; if (cents===200) return '2';
    return denominations.find(([,label])=>label===coin.denomination_display)?.[0] || '';
  }
  function referenceCandidates(grade, denomination='', designId=null, dataset=references) {
    const valid=dataset.filter(r=>r.grade===grade && r.source && r.rightsNote && (
      (/^condition-references\/[a-zA-Z0-9_./-]+$/.test(r.image||'') && !r.image.includes('..')) ||
      (/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:[a-zA-Z0-9_./-]|%[0-9A-Fa-f]{2})+$/.test(r.image||'') && r.license && r.licenseUrl)
    ));
    return [
      ...valid.filter(r=>designId && r.designId===designId && r.denomination===denomination),
      ...valid.filter(r=>!r.designId && r.denomination===denomination && denomination),
      ...valid.filter(r=>!r.designId && !r.denomination)
    ];
  }
  root.PocketMintConditionData={grades,issues,denominations,references,referenceSources,referenceAcquisition,source,normalise,denominationFor,referenceCandidates};
})(typeof window==='undefined'?globalThis:window);
