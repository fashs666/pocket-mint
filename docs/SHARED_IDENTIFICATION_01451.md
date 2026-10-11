# Shared identification — v0.14.51

Single photos and reviewed multi-coin crops already used the single identifier in v0.14.49. This release removes duplicated frontend request code: both now call requestSingleCoinIdentification with the same prepared JPEG, circulating/single flags and optional denomination/portrait. The batch header remains only for allowance/cache accounting.

Ben’s 11 October iPhone export contains 27 v0.14.49 batch records: five correct, four partial and eighteen wrong. Fifteen expected $1 crops were reported as 20c; ten had zero denomination confidence. Uncertain value readings previously restricted retrieval to that denomination. They now remain unknown when no face-value lettering is read, and uncertain automatic readings search across denominations. Explicit user denomination and strong contradictory-value guards remain. No colour/diameter denomination inference is introduced.

Coin Hunt matching accepts a distinctive engraved subject as independent evidence, alongside a read letter or exact reference comparison. Motif-only alphabet guesses remain uncertain. Unreadable value still requires review rather than automatic acceptance.

Manual or automatic rotation that changes pixels clears old predictions, observations, confirmation and saved-test identity. A retry clears old confirmation/results while loading or after failure. Successful recognition replaces old rotation/fallback text with its actual reason. Existing corrected-image persistence and sequential queue remain.

Single test exports now label the changed shared identifier v0.14.51 rather than the historical v0.14.16 baseline. Cameras, detection, catalogue and automatic orientation algorithm are unchanged.

Validation: npm run check passes; regression replays cover all ten zero-confidence 20c observations, cross-value Quoll retrieval, engraved subject matching, explicit denomination, identical single/batch request bodies and clearing stale predictions after rotation. Existing six-denomination, reference rejection, stamped-year, non-coin, async cancellation, queue and collection-confirmation checks pass. Replays use recorded first observations and controlled subsequent replies; the export has no photographs and does not prove improved live accuracy. Physical iPhone retesting and further automatic-rotation evaluation remain required.
