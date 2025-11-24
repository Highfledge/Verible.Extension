# 🎨 Logo Quick Start Guide

## 📦 Required Files

Place your logo files in these locations:

### Extension Icons (Required for Browser Stores)
```
public/icon/
├── 16.png   ✅ Required
├── 32.png   ✅ Required  
├── 48.png   ✅ Required
├── 96.png   ✅ Required
└── 128.png  ✅ Required
```

### UI Logo (Optional but Recommended)
```
public/logo/
├── logo.svg        ✅ Recommended (vector, scales to any size)
└── logo-64.png     ✅ Optional (for UI headers)
```

---

## 📐 Size Specifications

### Extension Icons
- **16x16px** - Browser toolbar
- **32x32px** - Windows taskbar
- **48x48px** - Extension management
- **96x96px** - Extension management (high DPI)
- **128x128px** - Browser store listing

### UI Logo
- **SVG** (recommended) - Vector format, scales perfectly
- **64x64px PNG** - For UI headers
- **128x128px PNG** - For loading screens

---

## ✅ Quick Steps

1. **Export your logo** at all required sizes (16, 32, 48, 96, 128px)
2. **Save as PNG** with transparent background
3. **Place in `public/icon/`** with exact names: `16.png`, `32.png`, etc.
4. **Create SVG version** (optional but recommended) → `public/logo/logo.svg`
5. **Rebuild extension**: `npm run build`
6. **Test**: Your logo will appear everywhere instead of "V"

---

## 🎯 Where Your Logo Will Appear

✅ Browser toolbar icon  
✅ Extension popup header  
✅ Sign In/Sign Up pages  
✅ Dashboard header  
✅ Loading screens  
✅ Content script overlay  
✅ Browser store listing  

---

## 💡 Tips

- **Start with SVG** - Create SVG first, export to PNG at different sizes
- **Transparent background** - Works better across themes
- **Simple design** - Should be clear at 16px
- **High contrast** - Stands out on any background
- **Test at small sizes** - Make sure it's recognizable at 16px

---

## 🔧 After Adding Your Logo

1. **Rebuild**: `npm run build`
2. **Test locally**: Load extension and verify logo appears
3. **Check all locations**: Toolbar, popup, auth pages, etc.

Your logo will automatically replace the "V" placeholder everywhere! 🚀
