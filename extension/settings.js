const dataUseConsentKey = 'dataUseAccepted';
const filterDefaults = {
  enabled: true,
  politicsEnabled: true,
  searchEnabled: true,
  blueCheckEnabled: false,
};

function readFilterSetting(key, value) {
  return typeof value === 'boolean' ? value : (filterDefaults[key] ?? false);
}
