// À coller dans Extensions > Apps Script du Google Sheet qui reçoit les candidatures.
// Voir README de déploiement fourni séparément.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'Nom', 'Prénom', 'Âge', 'Instagram', 'Téléphone', 'Ville', 'Motivation']);
  }

  sheet.appendRow([
    new Date(),
    data.nom || '',
    data.prenom || '',
    data.age || '',
    data.insta || '',
    data.tel || '',
    data.ville || '',
    data.motivation || '',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
