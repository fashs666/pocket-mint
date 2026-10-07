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
  // Add approved entries here; do not substitute catalogue artwork for a graded photo.
  // {grade:'VF', denomination:'2'|null, designId:null, image:'condition-references/vf.webp',
  //  source:'...', rightsNote:'...', description:'...', lookFor:['...'],
  //  callouts:[{x:50,y:30,label:'Highest point'}]}
  const references = [];
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
    const valid=dataset.filter(r=>r.grade===grade && /^condition-references\/[a-zA-Z0-9_./-]+$/.test(r.image||'') && !r.image.includes('..') && r.source && r.rightsNote);
    return [
      ...valid.filter(r=>designId && r.designId===designId && r.denomination===denomination),
      ...valid.filter(r=>!r.designId && r.denomination===denomination && denomination),
      ...valid.filter(r=>!r.designId && !r.denomination)
    ];
  }
  root.PocketMintConditionData={grades,issues,denominations,references,source,normalise,denominationFor,referenceCandidates};
})(typeof window==='undefined'?globalThis:window);
