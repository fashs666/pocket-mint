/* One diagnostic record for the entire reviewed photograph; no collection writes. */
(() => {
  const normal=angle=>((angle%360)+360)%360;
  async function build({items,sourceImage,sourceWidth,sourceHeight,appVersion,catalogueVersion}){
    if(!items.length)throw new Error('No coins to save');
    const images={'source-photo':sourceImage},encoded=new Map();
    async function image(file){
      if(encoded.has(file))return encoded.get(file);
      const key=`coin-image-${encoded.size+1}`;
      images[key]=await makeAnalysisImage(file);encoded.set(file,key);return key;
    }
    const coins=[];
    for(const item of items){
      const {crop,evidence,corrected}=item;
      const correction=evidence.manualDegrees??null;
      coins.push({region_id:crop.id,detection_number:crop.detectionNumber,
        crop_bounds:{x:crop.x,y:crop.y,width:crop.width,height:crop.height},
        original_image_ref:await image(crop.crop),automatic_image_ref:await image(evidence.automaticBlob||crop.crop),upright_image_ref:await image(corrected),
        automatic_attempted:Boolean(evidence.attempted),automatic_confident:Boolean(evidence.confident),automatic_reason:evidence.reason||'not_checked',
        automatic_applied_clockwise_degrees:evidence.angle||0,
        manual_correction_clockwise_degrees:correction,expected_clockwise_degrees:correction===null?null:normal((evidence.angle||0)+correction),
        automatic_correct:evidence.attempted&&correction!==null?normal(correction)===0:null,
        crop_edited:Boolean(evidence.cropEdited),crop_adjustments:evidence.cropAdjustments||[],upright_confirmed:true});
    }
    return {id:crypto.randomUUID(),created_at:new Date().toISOString(),app_version:appVersion,catalogue_version:catalogueVersion,
      flow:'batch_rotation',report_type:'rotation_batch',outcome:'rotation_reviewed',rotation_report_version:1,
      source_image_ref:'source-photo',source_dimensions:{width:sourceWidth,height:sourceHeight},
      image_encoding:'768px contained JPEG; source photo retains batch working dimensions',
      total_coins:coins.length,coins,images};
  }
  window.BatchRotationReport={build};
})();
