// Universal Links iOS : associe savemycommunity.com/@pseudo à l'application.
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = process.env.IOS_BUNDLE_ID ?? 'com.savemycommunity.app';
  return Response.json({
    applinks: {
      details: teamId ? [{ appIDs: [`${teamId}.${bundleId}`], components: [{ '/': '/@*', comment: 'Creator profiles' }] }] : [],
    },
  });
}
