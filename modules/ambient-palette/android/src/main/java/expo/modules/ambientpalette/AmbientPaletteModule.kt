package expo.modules.ambientpalette

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.palette.graphics.Palette
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AmbientPaletteModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AmbientPalette")

    AsyncFunction("dominantColor") { uri: String ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      val bitmap = runCatching {
        context.contentResolver.openInputStream(Uri.parse(uri))?.use {
          BitmapFactory.decodeStream(it)
        }
      }.getOrNull() ?: return@AsyncFunction null

      val palette = Palette.from(bitmap).generate()
      val swatch = palette.dominantSwatch
        ?: palette.vibrantSwatch
        ?: palette.mutedSwatch
        ?: return@AsyncFunction null
      String.format("#%06X", 0xFFFFFF and swatch.rgb)
    }
  }
}
