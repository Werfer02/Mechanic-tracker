const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

function documentSaverModule(packageName) {
  return `package ${packageName}

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = DocumentSaverModule.NAME)
class DocumentSaverModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
  companion object {
    const val NAME = "DocumentSaver"
    private const val CREATE_DOCUMENT_REQUEST_CODE = 48192
  }

  private var pendingPromise: Promise? = null
  private var pendingContents: String? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun createDocument(fileName: String, mimeType: String, contents: String, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("E_DOCUMENT_IN_PROGRESS", "A save operation is already in progress.")
      return
    }

    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No Android activity is available to save the file.")
      return
    }

    pendingPromise = promise
    pendingContents = contents

    try {
      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mimeType
        putExtra(Intent.EXTRA_TITLE, fileName)
      }
      activity.startActivityForResult(intent, CREATE_DOCUMENT_REQUEST_CODE)
    } catch (error: Exception) {
      clearPending()
      promise.reject("E_CREATE_DOCUMENT", "Could not open the Android save dialog.", error)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != CREATE_DOCUMENT_REQUEST_CODE) return

    val promise = pendingPromise ?: return
    val contents = pendingContents.orEmpty()
    clearPending()

    if (resultCode != Activity.RESULT_OK || data?.data == null) {
      promise.resolve(null)
      return
    }

    try {
      val uri = data.data ?: throw IllegalStateException("No destination was selected.")
      activity.contentResolver.openOutputStream(uri)?.use { stream ->
        stream.write(contents.toByteArray(Charsets.UTF_8))
        stream.flush()
      } ?: throw IllegalStateException("Could not open the selected destination.")
      promise.resolve(uri.toString())
    } catch (error: Exception) {
      promise.reject("E_WRITE_DOCUMENT", "Could not write the backup to the selected location.", error)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    reactContext.removeActivityEventListener(this)
    clearPending()
    super.invalidate()
  }

  private fun clearPending() {
    pendingPromise = null
    pendingContents = null
  }
}
`;
}

function documentSaverPackage(packageName) {
  return `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DocumentSaverPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(DocumentSaverModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;
}

module.exports = function withDocumentSaver(config) {
  return withDangerousMod(config, [
    'android',
    async config => {
      const packageName = config.android?.package;
      if (!packageName) {
        throw new Error('Android package name is required to configure document saving');
      }

      const kotlinDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...packageName.split('.'),
      );
      fs.mkdirSync(kotlinDir, { recursive: true });
      fs.writeFileSync(
        path.join(kotlinDir, 'DocumentSaverModule.kt'),
        documentSaverModule(packageName),
      );
      fs.writeFileSync(
        path.join(kotlinDir, 'DocumentSaverPackage.kt'),
        documentSaverPackage(packageName),
      );

      const mainApplicationPath = path.join(kotlinDir, 'MainApplication.kt');
      let mainApplication = fs.readFileSync(mainApplicationPath, 'utf8');
      if (!mainApplication.includes('add(DocumentSaverPackage())')) {
        const packageListMarker = 'PackageList(this).packages.apply {';
        if (!mainApplication.includes(packageListMarker)) {
          throw new Error('Could not find the React package registration block');
        }
        mainApplication = mainApplication.replace(
          packageListMarker,
          `${packageListMarker}\n              add(DocumentSaverPackage())`,
        );
        fs.writeFileSync(mainApplicationPath, mainApplication);
      }

      return config;
    },
  ]);
};