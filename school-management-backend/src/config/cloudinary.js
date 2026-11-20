const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: { folder: `school_mgmt/${folder}`, allowed_formats: ['jpg','jpeg','png','pdf','doc','docx','xlsx','mp4'] },
  });

const upload = (folder) => multer({
  storage: createStorage(folder),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Images only (logos): jpg / png / webp, max 2 MB
const uploadImage = (folder) => multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: { folder: `school_mgmt/${folder}`, allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\/(jpe?g|png|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Logo must be a JPG, PNG or WEBP image')),
});

module.exports = { cloudinary, upload, uploadImage };
