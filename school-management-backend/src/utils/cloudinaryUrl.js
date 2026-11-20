// 'https://res.cloudinary.com/x/image/upload/v123/school_mgmt/school-logos/abc.png'
//   -> 'school_mgmt/school-logos/abc'   (only if it lives under the given folder)
const publicIdFromUrl = (url, folder) => {
  const m = String(url || '').match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  if (!m) return null;
  return m[1].startsWith(`${folder}/`) ? m[1] : null;
};

module.exports = { publicIdFromUrl };
