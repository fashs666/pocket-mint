/* Shared owned-record controls, used by the existing Add/Edit/Detail dialog. */
function conditionEditorHtml(raw) {
  const data=window.PocketMintConditionData,record=data.normalise(raw);
  const legacy=raw.condition && !record.conditionGrade ? raw.condition : '';
  return `<div class="condition-editor"><label for="dCondition">Condition</label><select id="dCondition"><option value="">Not recorded</option>${data.grades.map(g=>`<option value="${g.grade}" ${record.conditionGrade===g.grade?'selected':''}>${g.grade} — ${g.name}</option>`).join('')}</select><p class="condition-owner">Owner estimate</p><button type="button" class="condition-help" data-condition-guide><span class="condition-help-icon" aria-hidden="true">i</span> See condition guide</button>${legacy?`<p class="condition-owner">Previous entry: ${esc(legacy)}. Choose a grade when ready.</p>`:''}<fieldset><legend>Issues &amp; characteristics</legend><div class="condition-issues">${data.issues.map(i=>`<label class="condition-issue"><input type="checkbox" name="conditionIssue" value="${i.id}" ${record.conditionIssues.includes(i.id)?'checked':''}><span>${i.label}</span></label>`).join('')}</div><p class="condition-owner">Record separately from wear. Toning is a characteristic, not necessarily damage.</p></fieldset></div>`;
}
function conditionSummaryHtml(raw) {
  const data=window.PocketMintConditionData,record=data.normalise(raw),grade=data.grades.find(g=>g.grade===record.conditionGrade);
  if(!grade&&!record.conditionIssues.length)return '';
  return `<div class="condition-summary">${grade?`<div><b>Condition: ${grade.grade} — ${grade.name}</b><small>Owner estimate</small></div><button type="button" data-condition-guide aria-label="View ${grade.grade} condition guide">i</button>`:''}${record.conditionIssues.length?`<p>Issues: ${data.issues.filter(i=>record.conditionIssues.includes(i.id)).map(i=>i.label).join(' · ')}</p>`:''}</div>`;
}
function conditionEditorValue(box, previous) {
  const conditionGrade=box.querySelector('#dCondition').value||null;
  const conditionIssues=[...box.querySelectorAll('input[name="conditionIssue"]:checked')].map(input=>input.value);
  // Preserve unrecognised historical labels (Poor/Fair) until the owner changes the field.
  const unchangedLegacy=!conditionGrade && !window.PocketMintConditionData.normalise(previous).conditionGrade && !box.querySelector('#dCondition').dataset.changed;
  return {conditionGrade,conditionSource:'owner',conditionIssues,condition:unchangedLegacy?previous.condition||'':''};
}
function bindConditionControls(box, coin) {
  box.querySelector('#dCondition').addEventListener('change',event=>{event.target.dataset.changed='true';});
  box.querySelectorAll('[data-condition-guide]').forEach(button=>button.onclick=()=>{
    window.PocketMintConditionGuide.open({
      grade:box.querySelector('#dCondition').value||undefined,
      denomination:window.PocketMintConditionData.denominationFor(coin),designId:coin.design_id||null,
      onSelect:grade=>{const select=box.querySelector('#dCondition');select.value=grade;select.dataset.changed='true';}
    });
  });
}
