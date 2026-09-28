/* A report is diagnostic data only: never changes a collection record. */
(() => {
  function resolveExpected(label, coins) {
    return coins.find(coin => `${coin.year} ${coin.title}`.toLocaleLowerCase() === String(label).trim().toLocaleLowerCase()) || null;
  }
  function score(expected, predicted, predictedDenomination=predicted?.denomination_display) {
    if (!expected) return {denomination_correct:null,design_correct:null,issue_correct:null};
    return {
      denomination_correct:predictedDenomination ? expected.denomination_display === predictedDenomination : false,
      design_correct:predicted ? (expected.design_id || expected.id) === (predicted.design_id || predicted.id) : false,
      issue_correct:predicted ? expected.id === predicted.id : false
    };
  }
  function fields({flow,expectedLabel,expectedCoin,predictedCoin,predictedDenomination=predictedCoin?.denomination_display,context={}}) {
    return {
      flow,expected_label:expectedLabel,expected_coin_id:expectedCoin?.id||null,
      expected_denomination:expectedCoin?.denomination_display||null,
      expected_design_id:expectedCoin?.design_id||expectedCoin?.id||null,
      predicted_label:predictedCoin?`${predictedCoin.year} ${predictedCoin.title}`:null,
      predicted_coin_id:predictedCoin?.id||null,
      predicted_denomination:predictedDenomination||null,
      predicted_design_id:predictedCoin?.design_id||predictedCoin?.id||null,
      ...score(expectedCoin,predictedCoin,predictedDenomination),...context
    };
  }
  window.PocketMintIdentificationReport={resolveExpected,score,fields};
})();
