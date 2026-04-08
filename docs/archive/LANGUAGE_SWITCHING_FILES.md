# Language Switching Implementation - Files Changed

This document lists all files that were modified or created to implement language switching functionality in the React Native app. Use this as a reference to implement the same feature in your web version.

## 📁 Core Files (MUST HAVE)

### 1. **`frontend/utils/i18n.js`** ⭐ CORE FILE
**Purpose:** Main i18n configuration file
**What it does:**
- Defines all translation objects for 10 languages (en, hi, bn, ta, te, kn, ml, mr, gu, pa)
- Sets up i18n instance with `I18n` from `i18n-js`
- Auto-detects device locale using `expo-localization`
- Exports `setLocale()` function for changing language
- Exports `addLanguageChangeListener()` for reactive updates
- Exports `notifyLanguageChange()` to trigger listeners

**Key Exports:**
```javascript
export default i18n; // Main translation function
export const setLocale = (locale) => {...}; // Change language
export const addLanguageChangeListener = (listener) => {...}; // Subscribe to changes
```

---

## 📱 App Initialization (REQUIRED)

### 2. **`frontend/App.js`**
**Changes Made:**
1. **Import i18n functions:**
   ```javascript
   import i18n, { addLanguageChangeListener, setLocale } from './utils/i18n';
   ```

2. **State for language tracking:**
   ```javascript
   const [currentLanguage, setCurrentLanguage] = useState(i18n.locale);
   ```

3. **Listen for language changes (in both App and TabNavigator):**
   ```javascript
   useEffect(() => {
     const unsubscribe = addLanguageChangeListener(() => {
       setCurrentLanguage(i18n.locale); // Force re-render
     });
     return unsubscribe;
   }, []);
   ```

4. **Load saved language on app start:**
   ```javascript
   useEffect(() => {
     const loadLanguage = async () => {
       const savedLanguage = await AsyncStorage.getItem('appLanguage');
       if (savedLanguage) {
         setLocale(savedLanguage);
       }
     };
     loadLanguage();
   }, []);
   ```

5. **Use translations in navigation:**
   ```javascript
   // In Tab.Navigator screenOptions
   headerTitle: i18n.t('dashboard'),
   tabBarLabel: i18n.t('assignment') || 'Assignments',
   ```

---

## 🎛️ Language Selector Screens (WHERE USERS CHANGE LANGUAGE)

### 3. **`frontend/screens/MoreOptionsScreen.js`** ⭐ PRIMARY LANGUAGE SELECTOR
**Changes Made:**
1. **Import i18n:**
   ```javascript
   import i18n, { setLocale } from '../utils/i18n';
   ```

2. **Language options array:**
   ```javascript
   const languageOptions = [
     { code: 'en', label: 'English' },
     { code: 'hi', label: 'Hindi' },
     // ... 10 languages
   ];
   ```

3. **Load saved language on mount:**
   ```javascript
   useEffect(() => {
     const loadLanguage = async () => {
       const lang = await AsyncStorage.getItem('appLanguage');
       if (lang) {
         setSelectedLanguage(lang);
         setLocale(lang);
       } else {
         const deviceLang = Localization.locale.split('-')[0];
         setSelectedLanguage(deviceLang);
         setLocale(deviceLang);
       }
     };
     loadLanguage();
   }, []);
   ```

4. **Handle language selection:**
   ```javascript
   const handleLanguageSelect = async (lang) => {
     setSelectedLanguage(lang);
     setLocale(lang); // Change language
     await AsyncStorage.setItem('appLanguage', lang); // Save preference
     setLanguageModalVisible(false);
   };
   ```

5. **Language selector modal UI** (lines 184-219)

### 4. **`frontend/screens/SettingsScreen.js`** ⭐ ALTERNATIVE LANGUAGE SELECTOR
**Changes Made:**
1. **Import i18n:**
   ```javascript
   import i18n, { setLocale } from '../utils/i18n';
   ```

2. **Language selection handler:**
   ```javascript
   const handleSelectLanguage = async (code) => {
     setSelectedLanguage(code);
     await AsyncStorage.setItem('appLanguage', code);
     setLocale(code);
   };
   ```

3. **Load saved language:**
   ```javascript
   useEffect(() => {
     const lang = await AsyncStorage.getItem('appLanguage');
     if (lang) setSelectedLanguage(lang);
   }, []);
   ```

### 5. **`frontend/screens/ProfileScreen.js`**
**Changes Made:**
1. **Import i18n:**
   ```javascript
   import i18n, { setLocale } from '../utils/i18n';
   ```

2. **Language change handler (line ~113):**
   ```javascript
   setLocale(code);
   ```

---

## 📄 Screen Components (USING TRANSLATIONS)

### 6. **`frontend/screens/LoginScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses `i18n.t()` for form labels, placeholders, buttons

### 7. **`frontend/screens/DashboardScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations: `i18n.t('noSoldiersFound')`, `i18n.t('recentAlerts')`, `i18n.t('unknownLocation')`

### 8. **`frontend/screens/HomeScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations for UI text

### 9. **`frontend/screens/GeospatialScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations for map-related text

### 10. **`frontend/screens/ReportsScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations for report-related text

### 11. **`frontend/screens/NotificationsScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations for notification text

### 12. **`frontend/screens/SoldierDashboardScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations for soldier dashboard

### 13. **`frontend/screens/PasswordRecoveryScreen.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations for password recovery form

---

## 🔧 Services & Components (USING TRANSLATIONS)

### 14. **`frontend/services/backgroundLocationService.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses `i18n.t('locationTracking')` for notification titles

### 15. **`frontend/NotificationContext.js`**
**Changes:**
- `import i18n from './utils/i18n';`
- Uses translations for notification messages

### 16. **`frontend/components/SideDrawer.js`**
**Changes:**
- `import i18n from '../utils/i18n';`
- Uses translations for drawer menu items

### 17. **`frontend/sendTestNotification.js`**
**Changes:**
- `import i18n from './utils/i18n';`
- Uses translations for test notifications

---

## 📦 Dependencies

### **`frontend/package.json`**
**Required packages:**
```json
{
  "i18n-js": "^4.5.1",
  "expo-localization": "~16.1.6"
}
```

**Storage:**
```json
{
  "@react-native-async-storage/async-storage": "2.1.2"
}
```

---

## 🔄 How Language Switching Works

### **Flow Diagram:**

```
1. User opens language selector (MoreOptionsScreen/SettingsScreen)
   ↓
2. User selects a language
   ↓
3. handleLanguageSelect() / handleSelectLanguage() called
   ↓
4. setLocale(code) executed
   ↓
5. i18n.locale updated
   ↓
6. notifyLanguageChange() triggers all listeners
   ↓
7. All registered components re-render
   ↓
8. Preference saved to AsyncStorage ('appLanguage')
   ↓
9. On next app start, saved language loaded automatically
```

### **Listener Pattern:**
- Components subscribe using `addLanguageChangeListener()`
- When language changes, all listeners are notified
- Components update their state, causing React re-render
- All `i18n.t()` calls now return translations in new language

---

## 🌐 Web Implementation Checklist

To apply this to your web version:

### ✅ **Step 1: Install Dependencies**
```bash
npm install i18n-js
# For web storage (instead of AsyncStorage):
npm install  # localStorage is built-in
```

### ✅ **Step 2: Create i18n Config**
- Copy `frontend/utils/i18n.js`
- Replace `expo-localization` with browser's `navigator.language`
- Replace `AsyncStorage` with `localStorage`

### ✅ **Step 3: Update Core Files**
- Main App component (React equivalent of `App.js`)
- Language selector component (equivalent of `MoreOptionsScreen.js`)
- Settings page (equivalent of `SettingsScreen.js`)

### ✅ **Step 4: Update All Screens**
- Add `import i18n from '../utils/i18n';`
- Replace hardcoded strings with `i18n.t('key')`
- Add language change listeners where needed

### ✅ **Step 5: Storage Migration**
```javascript
// Replace AsyncStorage with localStorage:
// OLD (React Native):
await AsyncStorage.getItem('appLanguage');
await AsyncStorage.setItem('appLanguage', code);

// NEW (Web):
localStorage.getItem('appLanguage');
localStorage.setItem('appLanguage', code);
```

### ✅ **Step 6: Locale Detection**
```javascript
// Replace expo-localization with browser API:
// OLD (React Native):
import * as Localization from 'expo-localization';
const locale = Localization.locale.split('-')[0];

// NEW (Web):
const locale = navigator.language.split('-')[0];
```

---

## 📊 Summary

**Total Files Modified: 17 files**

**Categories:**
- **Core:** 1 file (i18n.js)
- **App Setup:** 1 file (App.js)
- **Language Selectors:** 3 files (MoreOptionsScreen, SettingsScreen, ProfileScreen)
- **Screens Using Translations:** 8 files (LoginScreen, DashboardScreen, etc.)
- **Services/Components:** 4 files (backgroundLocationService, NotificationContext, etc.)

**Key Pattern:**
1. Import i18n: `import i18n from '../utils/i18n';`
2. Use translations: `i18n.t('translationKey')`
3. For language changes: Import `setLocale` and call `setLocale('en')`
4. For reactive updates: Use `addLanguageChangeListener()`

---

## 🎯 Quick Reference

**Translation Usage:**
```javascript
// Simple
<Text>{i18n.t('profile')}</Text>

// With fallback
<Text>{i18n.t('dashboard') || 'Dashboard'}</Text>

// In objects
options={{ title: i18n.t('assignment') }}
```

**Changing Language:**
```javascript
import { setLocale } from '../utils/i18n';
setLocale('hi'); // Change to Hindi
```

**Listening to Changes:**
```javascript
import { addLanguageChangeListener } from '../utils/i18n';

useEffect(() => {
  const unsubscribe = addLanguageChangeListener(() => {
    // Component re-renders when language changes
    setCurrentLanguage(i18n.locale);
  });
  return unsubscribe;
}, []);
```

---

**End of Document**















