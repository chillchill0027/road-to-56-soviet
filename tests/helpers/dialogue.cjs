// Click displayed replies, never inject a policy or resources into the game.
async function replyPolicy(page, option, key) {
  let count = 0;
  while (await page.locator(".vn-choice").count()) {
    if (++count > 7) throw new Error("dialogue exceeded seven rounds");
    const button = page.locator(`.vn-choice[data-i="${option}"]`);
    if (key) await page.keyboard.press(key);
    else await button.click();
  }
  return count;
}
async function choosePolicy(page, option, key) {
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
module.exports = { replyPolicy, choosePolicy, executeAgenda };
