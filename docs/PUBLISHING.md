# Publishing Verible Extension Guide

This guide will walk you through publishing your Verible browser extension to the major browser stores.

## 📋 Pre-Publication Checklist

### 1. Update Package Information
- [ ] Update `package.json` with correct name, version, and description
- [ ] Set proper version number (follow semantic versioning: MAJOR.MINOR.PATCH)
- [ ] Update extension name and description

### 2. Build the Extension
- [ ] Run `npm run build` for Chrome/Edge
- [ ] Run `npm run build:firefox` for Firefox
- [ ] Test the built extension locally
- [ ] Verify all features work correctly

### 3. Prepare Assets
- [ ] **Icons**: Ensure you have all required icon sizes
  - 16x16px (toolbar icon)
  - 32x32px (Windows)
  - 48x48px (extension management page)
  - 96x96px (extension management page)
  - 128x128px (store listing, recommended)
- [ ] **Screenshots**: Prepare 1-5 screenshots (1280x800px or 640x400px)
- [ ] **Promotional Images** (optional but recommended):
  - Small promotional tile: 440x280px
  - Large promotional tile: 920x680px
  - Marquee promotional tile: 1400x560px

### 4. Privacy & Legal
- [ ] Create Privacy Policy document
- [ ] Create Terms of Service (if applicable)
- [ ] Understand data collection practices
- [ ] Prepare privacy policy URL

### 5. Store Listing Content
- [ ] Write compelling description (132+ characters)
- [ ] Write detailed description (up to 16,000 characters)
- [ ] Prepare short description (132 characters)
- [ ] Choose appropriate categories
- [ ] Prepare keywords/tags
- [ ] Create promotional text (if applicable)

---

## 🚀 Step-by-Step Publishing Process

### Step 1: Build Your Extension

#### For Chrome/Edge:
```bash
npm run build
```

This creates a `.output/chrome-mv3` directory with your extension.

#### For Firefox:
```bash
npm run build:firefox
```

This creates a `.output/firefox-mv2` directory with your extension.

### Step 2: Create ZIP Files

#### Chrome/Edge ZIP:
```bash
npm run zip
```

This creates `extension-chrome.zip` in the `.output` directory.

#### Firefox ZIP:
```bash
npm run zip:firefox
```

This creates `extension-firefox.zip` in the `.output` directory.

---

## 🌐 Chrome Web Store

### 1. Developer Account Setup
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the **one-time $5 registration fee**
3. Complete your developer account setup

### 2. Upload Your Extension
1. Click **"New Item"** button
2. Upload your `extension-chrome.zip` file
3. Fill in the required information:

#### Basic Information:
- **Name**: Verible - Trust Analysis for Marketplace Sellers
- **Summary**: Short description (132 characters max)
- **Description**: Detailed description (up to 16,000 characters)
- **Category**: Choose appropriate category (e.g., "Shopping", "Productivity")
- **Language**: Select primary language

#### Graphics:
- **Icon**: Upload 128x128px icon
- **Screenshots**: Upload 1-5 screenshots (1280x800px or 640x400px)
- **Promotional Images** (optional): 440x280px, 920x680px, 1400x560px

#### Privacy:
- **Privacy Policy URL**: Required (must be publicly accessible)
- **Single Purpose Description**: Describe what your extension does
- **Permission Justifications**: Explain why you need each permission

#### Content Rating:
- Complete the questionnaire about your extension's content

### 3. Store Listing Details

#### Example Description:
```
Verible helps you make safer marketplace purchasing decisions by analyzing seller trustworthiness across multiple platforms including Facebook Marketplace, Jiji.ng, Craigslist, and OfferUp.

KEY FEATURES:
✅ Real-time Trust Score Analysis
✅ Multi-platform Marketplace Support
✅ Secure Authentication System
✅ Persistent Login (No repeated logins needed)
✅ Detailed Seller Insights
✅ Price Analysis and Risk Assessment

HOW IT WORKS:
1. Browse marketplace listings as usual
2. Verible automatically analyzes seller information
3. Get instant trust scores and risk assessments
4. Make informed purchasing decisions

SECURE & PRIVATE:
- Encrypted token storage
- Secure authentication
- No tracking of your browsing habits
- All analysis happens securely through our API

SUPPORTED PLATFORMS:
• Facebook Marketplace
• Jiji.ng
• Craigslist
• OfferUp
```

### 4. Submit for Review
1. Review all information carefully
2. Click **"Submit for Review"**
3. Wait for review (typically 1-3 business days)
4. Address any feedback from reviewers

### 5. After Approval
- Your extension will be live on the Chrome Web Store
- Users can install it from the store
- Monitor reviews and ratings
- Update as needed using the same process

---

## 🦊 Firefox Add-ons (AMO)

### 1. Developer Account Setup
1. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Create a Firefox account (free)
3. Verify your email address

### 2. Submit Your Extension
1. Click **"Submit a New Add-on"**
2. Choose **"On this site"** (for public distribution)
3. Upload your `extension-firefox.zip` file
4. Fill in the required information:

#### Basic Information:
- **Name**: Verible - Trust Analysis for Marketplace Sellers
- **Summary**: Short description
- **Description**: Detailed description
- **Categories**: Select appropriate categories
- **Tags**: Add relevant tags

#### Graphics:
- **Icon**: Upload 64x64px icon (required)
- **Screenshots**: Upload screenshots (recommended)

#### Privacy:
- **Privacy Policy URL**: Required
- **Data Collection**: Describe what data you collect
- **Permissions**: Justify each permission

### 3. Content Rating
- Complete content rating questionnaire
- Specify if your extension contains mature content

### 4. Review Process
- **Automatic Review**: Simple extensions (typically approved within hours)
- **Manual Review**: Complex extensions (1-3 business days)
- Address any feedback from reviewers

### 5. After Approval
- Extension is live on AMO
- Users can install from addons.mozilla.org
- Monitor reviews and support requests

---

## 🪟 Microsoft Edge Add-ons

### 1. Developer Account Setup
1. Go to [Partner Center](https://partner.microsoft.com/dashboard)
2. Sign in with Microsoft account
3. Complete developer registration (free)

### 2. Submit Your Extension
1. Navigate to **"Edge Add-ons"** section
2. Click **"Create new extension"**
3. Upload your `extension-chrome.zip` file (Edge uses same format as Chrome)
4. Fill in store listing information (similar to Chrome Web Store)

### 3. Review Process
- Similar to Chrome Web Store
- Typically 1-3 business days
- Address any feedback

---

## 📝 Required Documents

### Privacy Policy Template
Create a privacy policy at a publicly accessible URL. Here's a template:

```markdown
# Verible Privacy Policy

Last Updated: [Date]

## Introduction
Verible ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our browser extension.

## Information We Collect
- User account information (email, name, phone) when you register
- Authentication tokens for secure access
- Marketplace seller information you choose to analyze
- Browser extension usage analytics (anonymous)

## How We Use Information
- To provide trust analysis services
- To maintain your account and authentication
- To improve our services
- To communicate with you about your account

## Data Storage
- Authentication data is encrypted and stored locally in your browser
- API requests are made securely to our backend service
- We do not store your browsing history

## Third-Party Services
We use the following third-party services:
- [Your Backend API] - For authentication and analysis services

## Your Rights
You have the right to:
- Access your personal data
- Delete your account and data
- Opt-out of data collection (where applicable)

## Contact Us
For questions about this Privacy Policy, contact us at: [Your Email]

## Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
```

### Terms of Service (Optional but Recommended)
Create a Terms of Service document outlining:
- User responsibilities
- Service limitations
- Intellectual property
- Liability disclaimers

---

## 🎨 Asset Requirements Summary

| Asset Type | Size | Format | Required For |
|------------|------|--------|--------------|
| Icon | 128x128px | PNG | Chrome, Firefox, Edge |
| Icon | 64x64px | PNG | Firefox |
| Screenshot | 1280x800px or 640x400px | PNG/JPG | All stores |
| Promo Tile (Small) | 440x280px | PNG/JPG | Chrome (optional) |
| Promo Tile (Large) | 920x680px | PNG/JPG | Chrome (optional) |
| Promo Tile (Marquee) | 1400x560px | PNG/JPG | Chrome (optional) |

---

## 🔄 Updating Your Extension

### After Publishing:
1. Make changes to your code
2. Update version number in `package.json`
3. Build new version: `npm run build`
4. Create new ZIP: `npm run zip`
5. Go to store developer dashboard
6. Upload new version
7. Submit for review

### Version Numbering:
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes

---

## 📊 Post-Publication Checklist

- [ ] Monitor user reviews and ratings
- [ ] Respond to user feedback
- [ ] Track analytics and usage
- [ ] Fix reported bugs
- [ ] Plan feature updates
- [ ] Monitor store listing performance
- [ ] Update screenshots if UI changes
- [ ] Keep privacy policy updated

---

## 🆘 Troubleshooting

### Common Issues:

1. **Extension rejected for permissions**
   - Clearly justify each permission in your listing
   - Update your privacy policy to explain data usage

2. **Review takes too long**
   - Be patient (1-3 business days is normal)
   - Check your email for reviewer feedback

3. **Extension crashes on install**
   - Test thoroughly before submitting
   - Check browser console for errors
   - Verify all dependencies are included

4. **Store listing not showing**
   - Wait for review approval
   - Check if your extension is in "Draft" status
   - Verify all required fields are filled

---

## 📚 Additional Resources

- [Chrome Web Store Developer Guide](https://developer.chrome.com/docs/webstore/)
- [Firefox Add-ons Developer Guide](https://extensionworkshop.com/)
- [Edge Add-ons Developer Guide](https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/)
- [WXT Documentation](https://wxt.dev/)

---

## 💡 Tips for Success

1. **Write compelling descriptions** - Focus on user benefits
2. **Use high-quality screenshots** - Show your extension in action
3. **Respond to reviews** - Build trust with users
4. **Update regularly** - Keep improving and fixing bugs
5. **Monitor analytics** - Understand how users interact with your extension
6. **Build a community** - Consider social media, website, or support forum

---

Good luck with your publication! 🚀
