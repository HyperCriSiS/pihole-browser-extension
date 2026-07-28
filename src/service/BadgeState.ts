export const composeTabBadgeText = (
  globalText: string,
  domainBlocked: boolean,
): string => (domainBlocked && globalText === 'On' ? 'On!' : globalText)
