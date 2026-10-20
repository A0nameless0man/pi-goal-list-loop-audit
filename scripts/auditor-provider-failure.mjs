/** Account failures cannot heal inside Pi's automatic stream retries. The
 * parent owns candidate fallback; keep this shared with the isolated worker. */
export function isAuditorAccountFailure(error) {
  return typeof error === "string" && /\b429\b|rate[\s_-]*limit|too many requests|quota|billing|insufficient[\s_-]+(?:credits?|balance)|token[\s_-]*plan|usage[\s_-]*limit|plan limit/i.test(error);
}
