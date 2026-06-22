const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const PROFILE_DIR = path.join(__dirname, '..', 'uploads', 'profiles');
const LOGO_DIR = path.join(__dirname, '..', 'uploads', 'logos');

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PROFILE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uuidv4()}${ext}`);
  }
});

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uuidv4()}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed.'), false);
  }
};

const uploadProfile = multer({
  storage: profileStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('avatar');

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('logo');

function handleUpload(req, res, next, uploadMiddleware) {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 2MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    next();
  });
}

module.exports = {
  uploadProfile,
  uploadLogo,
  handleUpload,
  PROFILE_DIR,
  LOGO_DIR
};
