package expo.modules.audiotags

import android.app.Activity
import android.content.ContentResolver
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.core.app.ActivityCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import org.jaudiotagger.tag.Tag
import org.jaudiotagger.tag.TagOptionSingleton
import org.jaudiotagger.tag.images.ArtworkFactory
import java.io.File
import java.net.URLConnection
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.Locale

private const val REQUEST_WRITE_ACCESS = 9871
private const val MAX_ARTWORK_BYTES = 10L * 1024L * 1024L

private val SUPPORTED_EXTENSIONS = setOf("mp3", "flac", "ogg", "oga", "m4a", "mp4")

private val MIME_EXTENSIONS = mapOf(
  "audio/mpeg" to "mp3",
  "audio/flac" to "flac",
  "audio/x-flac" to "flac",
  "audio/ogg" to "ogg",
  "audio/mp4" to "mp4",
  "audio/x-m4a" to "m4a",
  "audio/m4a" to "m4a",
)

class UnsupportedFormatException(uri: String) :
  CodedException("UNSUPPORTED_FORMAT", "Unsupported audio format: $uri", null)

class TagReadException(uri: String, cause: Throwable?) :
  CodedException("READ_FAILED", "Could not read tags from $uri", cause)

class TagWriteException(uri: String, cause: Throwable?) :
  CodedException("WRITE_FAILED", "Could not write tags to $uri", cause)

class FileMissingException(uri: String) :
  CodedException("FILE_NOT_FOUND", "Audio file not found: $uri", null)

class InvalidArtworkException(message: String) :
  CodedException("INVALID_ARTWORK", message, null)

class NoContextException :
  CodedException("NO_CONTEXT", "Android context is not available", null)

class NoActivityException :
  CodedException("NO_ACTIVITY", "No foreground activity is available", null)

class PendingWriteAccessException :
  CodedException("PENDING_WRITE_REQUEST", "Another write access request is pending", null)

class AudioTagsModule : Module() {
  private var writeAccessPromise: Promise? = null
  private var pendingUris: List<String> = emptyList()

  override fun definition() = ModuleDefinition {
    Name("AudioTags")

    OnCreate {
      TagOptionSingleton.getInstance().isAndroid = true
    }

    AsyncFunction("readTags") { uri: String ->
      readTags(uri)
    }

    AsyncFunction("writeTags") { uri: String, fields: Map<String, Any?>, artworkUri: String? ->
      writeTags(uri, fields, artworkUri)
    }

    AsyncFunction("requestWriteAccess") { uris: List<String>, promise: Promise ->
      requestWriteAccess(uris, promise)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_WRITE_ACCESS) return@OnActivityResult
      val promise = writeAccessPromise ?: return@OnActivityResult
      writeAccessPromise = null
      val granted = if (payload.resultCode == Activity.RESULT_OK) pendingUris else emptyList()
      pendingUris = emptyList()
      promise.resolve(granted)
    }
  }

  private fun requestWriteAccess(uris: List<String>, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(uris)
      return
    }
    val contentUris = uris.map { Uri.parse(it) }.filter { it.scheme == ContentResolver.SCHEME_CONTENT }
    if (contentUris.isEmpty()) {
      promise.resolve(uris)
      return
    }
    if (writeAccessPromise != null) throw PendingWriteAccessException()
    val activity = appContext.throwingActivity as? Activity ?: throw NoActivityException()
    val pendingIntent = MediaStore.createWriteRequest(contentResolver(), contentUris)
    writeAccessPromise = promise
    pendingUris = uris
    ActivityCompat.startIntentSenderForResult(
      activity,
      pendingIntent.intentSender,
      REQUEST_WRITE_ACCESS,
      null,
      0,
      0,
      0,
      null,
    )
  }

  private fun readTags(uriString: String): Map<String, Any?> {
    return withLocalCopy(uriString) { file ->
      try {
        readFromFile(file)
      } catch (error: CodedException) {
        throw error
      } catch (error: Exception) {
        throw TagReadException(uriString, error)
      }
    }
  }

  private fun writeTags(
    uriString: String,
    fields: Map<String, Any?>,
    artworkUri: String?,
  ): Map<String, Any?> {
    val uri = Uri.parse(uriString)
    if (uri.scheme == null || uri.scheme == "file") {
      val target = fileFor(uriString)
      return writeFileAtomically(uriString, target, fields, artworkUri)
    }
    if (uri.scheme != ContentResolver.SCHEME_CONTENT) throw UnsupportedFormatException(uriString)
    return writeContent(uriString, uri, fields, artworkUri)
  }

  private fun writeFileAtomically(
    uriString: String,
    target: File,
    fields: Map<String, Any?>,
    artworkUri: String?,
  ): Map<String, Any?> {
    val ext = extensionFor(target.name)
    if (ext !in SUPPORTED_EXTENSIONS) throw UnsupportedFormatException(uriString)
    val parent = target.parentFile ?: throw TagWriteException(uriString, null)
    val base = target.name.substringBeforeLast('.')
    val temp = File(parent, ".$base.krotify-${System.nanoTime()}.$ext")
    try {
      target.copyTo(temp, overwrite = true)
      applyFields(uriString, temp, fields, artworkUri)
      val refreshed = readFromFile(temp)
      Files.move(
        temp.toPath(),
        target.toPath(),
        StandardCopyOption.REPLACE_EXISTING,
        StandardCopyOption.ATOMIC_MOVE,
      )
      return refreshed
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw TagWriteException(uriString, error)
    } finally {
      temp.delete()
    }
  }

  private fun writeContent(
    uriString: String,
    uri: Uri,
    fields: Map<String, Any?>,
    artworkUri: String?,
  ): Map<String, Any?> {
    val ext = resolveExtension(uri) ?: throw UnsupportedFormatException(uriString)
    val edited = File.createTempFile("audio-tags-edit-", ".$ext", cacheDir())
    val backup = File.createTempFile("audio-tags-backup-", ".$ext", cacheDir())
    try {
      copyContent(uri, edited)
      edited.copyTo(backup, overwrite = true)
      applyFields(uriString, edited, fields, artworkUri)
      val refreshed = readFromFile(edited)
      val output = contentResolver().openOutputStream(uri, "wt")
        ?: throw TagWriteException(uriString, null)
      output.use { stream ->
        edited.inputStream().use { input -> input.copyTo(stream) }
      }
      return refreshed
    } catch (error: Exception) {
      try {
        contentResolver().openOutputStream(uri, "wt")?.use { stream ->
          backup.inputStream().use { input -> input.copyTo(stream) }
        }
      } catch (_: Exception) {
      }
      if (error is CodedException) throw error
      throw TagWriteException(uriString, error)
    } finally {
      edited.delete()
      backup.delete()
    }
  }

  private fun applyFields(
    uriString: String,
    file: File,
    fields: Map<String, Any?>,
    artworkUri: String?,
  ) {
    val audioFile = AudioFileIO.read(file)
    val tag = audioFile.tag ?: audioFile.createDefaultTag().also { audioFile.tag = it }

    (fields["title"] as? String)?.let { tag.setField(FieldKey.TITLE, it) }
    (fields["artist"] as? String)?.let { tag.setField(FieldKey.ARTIST, it) }
    (fields["album"] as? String)?.let { tag.setField(FieldKey.ALBUM, it) }
    (fields["albumArtist"] as? String)?.let { tag.setField(FieldKey.ALBUM_ARTIST, it) }
    (fields["genre"] as? String)?.let { tag.setField(FieldKey.GENRE, it) }
    (fields["trackNumber"] as? Number)?.let { tag.setField(FieldKey.TRACK, it.toInt().toString()) }
    (fields["discNumber"] as? Number)?.let { tag.setField(FieldKey.DISC_NO, it.toInt().toString()) }
    (fields["year"] as? Number)?.let { tag.setField(FieldKey.YEAR, it.toInt().toString()) }
    // jaudiotagger has no portable advisory field; the explicit flag stays cache-only.
    if (artworkUri != null) applyArtwork(uriString, tag, artworkUri)
    audioFile.commit()
  }

  private fun applyArtwork(uriString: String, tag: Tag, artworkUri: String) {
    val uri = Uri.parse(artworkUri)
    val mimeType = when {
      uri.scheme == ContentResolver.SCHEME_CONTENT -> contentResolver().getType(uri)
      else -> URLConnection.guessContentTypeFromName(artworkUri)
    }
    if (mimeType != null && !mimeType.lowercase(Locale.ROOT).startsWith("image/")) {
      throw InvalidArtworkException("Artwork must be an image.")
    }
    val local = artworkFile(uri, artworkUri)
    try {
      if (local.length() > MAX_ARTWORK_BYTES) {
        throw InvalidArtworkException("Artwork must be 10 MB or smaller.")
      }
      tag.setField(ArtworkFactory.createArtworkFromFile(local))
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw TagWriteException(uriString, error)
    } finally {
      if (uri.scheme == ContentResolver.SCHEME_CONTENT) local.delete()
    }
  }

  private fun artworkFile(uri: Uri, uriString: String): File {
    if (uri.scheme == null || uri.scheme == "file") {
      val file = fileFor(uriString)
      if (!file.exists()) throw FileMissingException(uriString)
      return file
    }
    val extension = when (contentResolver().getType(uri)) {
      "image/png" -> "png"
      "image/webp" -> "webp"
      else -> "jpg"
    }
    val file = File.createTempFile("audio-tags-art-", ".$extension", cacheDir())
    copyContent(uri, file)
    return file
  }

  private fun readFromFile(file: File): Map<String, Any?> {
    val audioFile = AudioFileIO.read(file)
    val tag = audioFile.tag ?: return emptyMap()
    val result = linkedMapOf<String, Any?>()
    first(tag, FieldKey.TITLE)?.let { result["title"] = it }
    first(tag, FieldKey.ARTIST)?.let { result["artist"] = it }
    first(tag, FieldKey.ALBUM)?.let { result["album"] = it }
    first(tag, FieldKey.ALBUM_ARTIST)?.let { result["albumArtist"] = it }
    first(tag, FieldKey.GENRE)?.let { result["genre"] = it }
    intPrefix(first(tag, FieldKey.TRACK))?.let { result["trackNumber"] = it }
    intPrefix(first(tag, FieldKey.DISC_NO))?.let { result["discNumber"] = it }
    intPrefix(first(tag, FieldKey.YEAR))?.let { result["year"] = it }
    explicitFlag(tag)?.let { result["explicit"] = it }
    return result
  }

  private fun first(tag: Tag, key: FieldKey): String? = try {
    tag.getFirst(key)?.takeIf { it.isNotBlank() }
  } catch (_: Exception) {
    null
  }

  private fun firstRaw(tag: Tag, key: String): String? = try {
    tag.getFirst(key)?.takeIf { it.isNotBlank() }
  } catch (_: Exception) {
    null
  }

  private fun intPrefix(value: String?): Int? {
    val digits = value?.trim()?.takeWhile { it.isDigit() } ?: return null
    return digits.toIntOrNull()
  }

  private fun explicitFlag(tag: Tag): Boolean? {
    val raw = firstRaw(tag, "TXXX:ITUNESADVISORY")
      ?: firstRaw(tag, "----:com.apple.iTunes:rtng")
      ?: return null
    return when (raw.trim().lowercase(Locale.ROOT)) {
      "1", "4", "explicit", "true", "yes" -> true
      "0", "2", "clean", "false", "no" -> false
      else -> null
    }
  }

  private fun <T> withLocalCopy(uriString: String, block: (File) -> T): T {
    val uri = Uri.parse(uriString)
    if (uri.scheme == null || uri.scheme == "file") {
      val file = fileFor(uriString)
      val ext = extensionFor(file.name)
      if (ext !in SUPPORTED_EXTENSIONS) throw UnsupportedFormatException(uriString)
      return block(file)
    }
    if (uri.scheme != ContentResolver.SCHEME_CONTENT) throw UnsupportedFormatException(uriString)
    val ext = resolveExtension(uri) ?: throw UnsupportedFormatException(uriString)
    val temp = File.createTempFile("audio-tags-read-", ".$ext", cacheDir())
    try {
      copyContent(uri, temp)
      return block(temp)
    } finally {
      temp.delete()
    }
  }

  private fun fileFor(uriString: String): File {
    val uri = Uri.parse(uriString)
    val path = when {
      uri.scheme == null || uri.scheme == "file" -> uri.path ?: uriString
      else -> throw UnsupportedFormatException(uriString)
    }
    val file = File(path)
    if (!file.exists()) throw FileMissingException(uriString)
    return file
  }

  private fun extensionFor(name: String): String =
    name.substringAfterLast('.', "").lowercase(Locale.ROOT)

  private fun resolveExtension(uri: Uri): String? {
    val mime = contentResolver().getType(uri)?.lowercase(Locale.ROOT)
    MIME_EXTENSIONS[mime]?.let { return it }
    contentResolver().query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val name = cursor.getString(0)
        val ext = extensionFor(name)
        if (ext in SUPPORTED_EXTENSIONS) return ext
      }
    }
    return MIME_EXTENSIONS[mime]
  }

  private fun copyContent(uri: Uri, target: File) {
    val input = contentResolver().openInputStream(uri)
      ?: throw TagReadException(uri.toString(), null)
    input.use { stream ->
      target.outputStream().use { output -> stream.copyTo(output) }
    }
  }

  private fun contentResolver(): ContentResolver =
    appContext.reactContext?.contentResolver ?: throw NoContextException()

  private fun cacheDir(): File =
    appContext.reactContext?.cacheDir ?: throw NoContextException()
}
