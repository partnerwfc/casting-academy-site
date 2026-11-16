// Android App Links : associe savemycommunity.app/@pseudo à l'application.
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!fingerprints.length) return Response.json([]);
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_PACKAGE ?? 'com.savemycommunity.app',
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
