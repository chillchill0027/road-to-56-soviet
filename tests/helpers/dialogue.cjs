// Click displayed replies, never inject a policy or resources into the game.
const sourceKinds = new Set();
async function observeSources(page) {
  for (const kind of await page
    .locator("#stage .world-source")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.kind)))
    sourceKinds.add(kind);
}
async function continueReports(page) {
  for (let n=0; n<25 && await page.locator('#annual-dialog[open]').count(); n++)
    await page.click('#annual-continue');
}
async function advanceScene(page) {
  const scene = await page.evaluate(() => S.curId);
  for (let n = 0; n < 8; n++) {
    await observeSources(page);
    await page.click("#next");
    await continueReports(page);
    if (await page.evaluate((id) => ENDED || S.curId !== id, scene)) return;
  }
  throw new Error("interlude did not finish");
}
async function replyPolicy(page, option, key) {
  let count = 0;
  while (await page.locator(".vn-choice").count()) {
    if (++count > 7) throw new Error("dialogue exceeded seven rounds");
    await observeSources(page);
    const button = page.locator(`.vn-choice[data-i="${option}"]`);
    if (key) await page.keyboard.press(key);
    else await button.click();
  }
  return count;
}
async function choosePolicy(page, option, key) {
  await observeSources(page);
  if (await page.locator(".vn-choice").count())
    return replyPolicy(page, option, key);
  if (key) await page.keyboard.press(key);
  else await page.locator(`.opt[data-i="${option}"]`).click();
  return 0;
}
async function executeAgenda(page, id) {
  await page.locator(`.db2[data-id="${id}"]`).click();
  return replyPolicy(page, 0);
}
module.exports = {
  continueReports,
  replyPolicy,
  choosePolicy,
  executeAgenda,
  advanceScene,
  observeSources,
  sourceKinds,
};
