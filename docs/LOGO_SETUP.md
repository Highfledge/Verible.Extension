# Logo Setup Guide for Verible Extension

## 📐 Required Logo Sizes

### Extension Icons (Browser Store & Extension UI)
Place these in: `public/icon/`

| Size | Purpose | Format | File Name |
|------|---------|--------|-----------|
| **16x16px** | Browser toolbar icon | PNG | `16.png` |
| **32x32px** | Windows taskbar, extension management | PNG | `32.png` |
| **48x48px** | Extension management page | PNG | `48.png` |
| **96x96px** | Extension management page (high DPI) | PNG | `96.png` |
| **128x128px** | Browser store listing, extension management | PNG | `128.png` |

### UI Logo (In-App Usage)
Place this in: `public/` or `public/logo/`

| Size | Purpose | Format | File Name |
|------|---------|--------|-----------|
| **64x64px** | Logo icon in headers (recommended) | PNG/SVG | `logo-64.png` or `logo.svg` |
| **128x128px** | Larger logo for loading screens | PNG/SVG | `logo-128.png` or `logo.svg` |
| **256x256px** | High-resolution logo (optional) | PNG/SVG | `logo-256.png` or `logo.svg` |

### SVG Logo (Recommended)
- **Vector format** (scales to any size)
- **File**: `public/logo.svg` or `public/verible-logo.svg`
- Can be used for all sizes above

---

## 📁 Directory Structure

```
public/
├── icon/
│   ├── 16.png      ✅ Required
│   ├── 32.png      ✅ Required
│   ├── 48.png      ✅ Required
│   ├── 96.png      ✅ Required
│   └── 128.png     ✅ Required
└── logo/
    ├── logo.svg           (Recommended - vector format)
    ├── logo-64.png        (For UI headers)
    ├── logo-128.png       (For loading screens)
    └── logo-256.png       (Optional - high res)
```

---

## 🎨 Logo Design Guidelines

### For Extension Icons (16px - 128px):
- **Square format** (1:1 aspect ratio)
- **Simple design** - should be recognizable at 16px
- **High contrast** - works on light and dark backgrounds
- **No text** - icon should be clear without reading text
- **Transparent background** (PNG with alpha channel)
- **Padding** - Leave 10-15% padding around edges

### For UI Logo:
- **Can include text** - "Verible" text can be part of logo
- **Transparent or solid background** - depends on your design
- **Scalable** - SVG preferred for crisp display at all sizes

---

## 📝 Step-by-Step Setup

### Step 1: Prepare Your Logo Files

1. **Create extension icons:**
   - Export your logo at: 16x16, 32x32, 48x48, 96x96, 128x128 pixels
   - Save as PNG with transparent background
   - Name them exactly: `16.png`, `32.png`, `48.png`, `96.png`, `128.png`

2. **Create UI logo:**
   - Export at 64x64px or higher (128px recommended)
   - Can be PNG or SVG
   - Save as `logo.svg` or `logo-64.png`

### Step 2: Place Files

```
📁 Copy your files to:
public/icon/16.png
public/icon/32.png
public/icon/48.png
public/icon/96.png
public/icon/128.png

📁 And optionally:
public/logo.svg (or logo-64.png)
```

### Step 3: Update Code

The code will automatically use your logos once you place them in the correct locations. The placeholder "V" will be replaced with your logo image.

---

## ✅ Quick Checklist

- [ ] Logo exported at 16x16px → `public/icon/16.png`
- [ ] Logo exported at 32x32px → `public/icon/32.png`
- [ ] Logo exported at 48x48px → `public/icon/48.png`
- [ ] Logo exported at 96x96px → `public/icon/96.png`
- [ ] Logo exported at 128x128px → `public/icon/128.png`
- [ ] UI logo created (64px or SVG) → `public/logo.svg` or `logo-64.png`
- [ ] All logos have transparent backgrounds
- [ ] Logos are clear and recognizable at small sizes
- [ ] Tested on light and dark backgrounds

---

## 🛠️ Tools for Creating Icons

### Online Tools:
- **Favicon.io** - https://favicon.io/ (Generate icons from image)
- **RealFaviconGenerator** - https://realfavicongenerator.net/
- **ImageMagick** - Command-line tool for resizing

### Design Tools:
- **Figma** - Export at multiple sizes
- **Adobe Illustrator** - Export as PNG at different sizes
- **Photoshop** - Create icon set

### Command Line (if you have ImageMagick):
```bash
# Resize logo to all required sizes
convert logo.png -resize 16x16 public/icon/16.png
convert logo.png -resize 32x32 public/icon/32.png
convert logo.png -resize 48x48 public/icon/48.png
convert logo.png -resize 96x96 public/icon/96.png
convert logo.png -resize 128x128 public/icon/128.png
```

---

## 📱 After Adding Your Logo

Once you've placed your logo files:

1. **Rebuild the extension:**
   ```bash
   npm run build
   ```

2. **Test locally:**
   - Load the extension in your browser
   - Check that the logo appears in:
     - Browser toolbar
     - Extension popup header
     - Sign In/Sign Up pages
     - Loading screens
     - Content script overlay

3. **Verify all sizes:**
   - Check extension management page
   - Check toolbar icon
   - Check extension popup

---

## 🎯 Logo Usage Locations

Your logo will be used in:
- ✅ Browser toolbar (16px, 32px)
- ✅ Extension popup header (64px recommended)
- ✅ Sign In/Sign Up pages
- ✅ Dashboard header
- ✅ Loading screens
- ✅ Content script overlay (marketplace pages)
- ✅ Browser store listing (128px)

---

## 💡 Tips

1. **Start with SVG** - Create your logo as SVG, then export to PNG at different sizes
2. **Test at small sizes** - Make sure your logo is recognizable at 16px
3. **Use transparent background** - Works better across different themes
4. **Keep it simple** - Complex designs don't work well at small sizes
5. **High contrast** - Ensure logo stands out on various backgrounds
6. **Consistent branding** - Use the same logo style across all sizes

---

## 🚀 Need Help?

If you need assistance:
1. Check that all files are in the correct directories
2. Verify file names match exactly (case-sensitive)
3. Ensure files are PNG format with transparency
4. Rebuild the extension after adding files
5. Clear browser cache if logo doesn't update
