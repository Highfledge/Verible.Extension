# 🚀 Verible Extension Publishing Checklist

Use this checklist to ensure you're ready to publish your extension.

## ✅ Pre-Build Checklist

- [ ] Update version in `package.json` (currently: 1.0.0)
- [ ] Test all features thoroughly
- [ ] Verify authentication flow works
- [ ] Test on multiple marketplace platforms
- [ ] Check for console errors
- [ ] Verify all icons are in `public/icon/` directory

## 📦 Build Process

### Chrome/Edge Build:
```bash
npm run build
npm run zip
```
- [ ] Build completed successfully
- [ ] ZIP file created at `.output/extension-chrome.zip`
- [ ] Test ZIP file by loading it as unpacked extension

### Firefox Build:
```bash
npm run build:firefox
npm run zip:firefox
```
- [ ] Build completed successfully
- [ ] ZIP file created at `.output/extension-firefox.zip`
- [ ] Test ZIP file by loading it as temporary extension

## 🎨 Assets Preparation

### Icons (Required):
- [ ] 16x16px icon (`public/icon/16.png`) ✅
- [ ] 32x32px icon (`public/icon/32.png`) ✅
- [ ] 48x48px icon (`public/icon/48.png`) ✅
- [ ] 96x96px icon (`public/icon/96.png`) ✅
- [ ] 128x128px icon (`public/icon/128.png`) ✅

### Screenshots (Recommended):
- [ ] Screenshot 1: Sign In page (1280x800px or 640x400px)
- [ ] Screenshot 2: Dashboard view (1280x800px or 640x400px)
- [ ] Screenshot 3: Trust analysis overlay (1280x800px or 640x400px)
- [ ] Screenshot 4: Marketplace integration (1280x800px or 640x400px)
- [ ] Screenshot 5: Settings/Profile (1280x800px or 640x400px)

### Promotional Images (Optional - Chrome only):
- [ ] Small promotional tile: 440x280px
- [ ] Large promotional tile: 920x680px
- [ ] Marquee promotional tile: 1400x560px

## 📄 Documentation

- [ ] Privacy Policy created and hosted at public URL
  - [ ] URL: _________________________
- [ ] Terms of Service created (optional)
- [ ] Store listing description written
- [ ] Short description (132 characters max) written
- [ ] Detailed description written

## 🌐 Chrome Web Store

### Account Setup:
- [ ] Developer account created
- [ ] $5 registration fee paid
- [ ] Account verified

### Submission:
- [ ] Extension ZIP uploaded
- [ ] Basic information filled
- [ ] Graphics uploaded
- [ ] Privacy policy URL added
- [ ] Permissions justified
- [ ] Content rating completed
- [ ] Submitted for review
- [ ] Review feedback addressed (if any)
- [ ] Extension published ✅

## 🦊 Firefox Add-ons (AMO)

### Account Setup:
- [ ] Firefox account created
- [ ] Email verified

### Submission:
- [ ] Extension ZIP uploaded
- [ ] Basic information filled
- [ ] Graphics uploaded
- [ ] Privacy policy URL added
- [ ] Permissions justified
- [ ] Content rating completed
- [ ] Submitted for review
- [ ] Review feedback addressed (if any)
- [ ] Extension published ✅

## 🪟 Microsoft Edge Add-ons

### Account Setup:
- [ ] Microsoft Partner Center account created
- [ ] Developer registration completed

### Submission:
- [ ] Extension ZIP uploaded (same as Chrome)
- [ ] Store listing information filled
- [ ] Submitted for review
- [ ] Review feedback addressed (if any)
- [ ] Extension published ✅

## 📊 Post-Publication

- [ ] Monitor user reviews
- [ ] Respond to user feedback
- [ ] Track installation metrics
- [ ] Fix reported bugs
- [ ] Plan feature updates
- [ ] Update screenshots if UI changes
- [ ] Keep privacy policy updated

## 🔄 Future Updates

When updating your extension:

1. [ ] Update version in `package.json`
2. [ ] Make code changes
3. [ ] Test thoroughly
4. [ ] Build new version (`npm run build`)
5. [ ] Create new ZIP (`npm run zip`)
6. [ ] Upload to store developer dashboard
7. [ ] Update store listing if needed
8. [ ] Submit for review
9. [ ] Monitor review status

---

## 📝 Quick Reference

### Version Numbering:
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

### Store Links:
- Chrome Web Store: https://chrome.google.com/webstore/devconsole
- Firefox Add-ons: https://addons.mozilla.org/developers/
- Edge Add-ons: https://partner.microsoft.com/dashboard

### Support:
- Check `docs/PUBLISHING.md` for detailed instructions
- Review store-specific developer documentation
- Check WXT documentation: https://wxt.dev/

---

**Good luck with your publication!** 🎉
