package expo.modules.audiotags

import android.app.Activity
import android.content.ContentResolver
import android.content.ContentUris
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
import org.jaudiotagger.tag.KeyNotFoundException
import org.jaudiotagger.tag.Tag
import org.jaudiotagger.tag.TagOptionSingleton
import org.jaudiotagger.tag.images.ArtworkFactory
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.net.URLConnection
import java.nio.file.AccessDeniedException
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.FileAlreadyExistsException
import java.nio.file.Files
import java.nio.file.ReadOnlyFileSystemException
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

private fun writeFailureMessage(uri: String, cause: Throwable?): String {
  val detail = cause?.message?.takeIf { it.isNotBlank() } ?: return "Could not write tags to $uri"
  return "Could not write tags to $uri: $detail"
}

private fun noWriteAccessMessage(uri: String, cause: Throwable?): String {
  val detail = cause?.message?.takeIf { it.isNotBlank() } ?: return "No write access to $uri"
  return "No write access to $uri: $detail"
}

private fun isPermissionFailure(error: Throwable): Boolean {
  var current: Throwable? = error
  while (current != null) {
    if (
      current is AccessDeniedException ||
      current is ReadOnlyFileSystemException ||
      current is SecurityException
    ) {
      return true
    }
    val message = current.message.orEmpty()
    if (
      message.contains("EACCES") ||
      message.contains("EPERM") ||
      message.contains("EROFS")
    ) {
      return true
    }
    current = current.cause
  }
  return false
}

class UnsupportedFormatException(uri: String) :
  CodedException("UNSUPPORTED_FORMAT", "Unsupported audio format: $uri", null)

class TagReadException(uri: String, cause: Throwable?) :
  CodedException("READ_FAILED", "Could not read tags from $uri", cause)

class TagWriteException(uri: String, cause: Throwable?) :
  CodedException("WRITE_FAILED", writeFailureMessage(uri, cause), cause)

class FileMissingException(uri: String) :
  CodedException("FILE_NOT_FOUND", "Audio file not found: $uri", null)

class NoWriteAccessException(uri: String, cause: Throwable? = null) :
  CodedException("NO_WRITE_ACCESS", noWriteAccessMessage(uri, cause), cause)

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
  private var pendingUngatedUris: List<String> = emptyList()

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

    AsyncFunction("snapshotFile") { uri: String ->
      snapshotFile(uri)
    }

    AsyncFunction("restoreFile") { uri: String, snapshotPath: String ->
      restoreFile(uri, snapshotPath)
    }

    AsyncFunction("discardSnapshot") { snapshotPath: String ->
      discardSnapshot(snapshotPath)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_WRITE_ACCESS) return@OnActivityResult
      val promise = writeAccessPromise ?: return@OnActivityResult
      writeAccessPromise = null
      val granted = if (payload.resultCode == Activity.RESULT_OK) pendingUris else pendingUngatedUris
      pendingUris = emptyList()
      pendingUngatedUris = emptyList()
      promise.resolve(granted)
    }
  }

  private fun requestWriteAccess(uris: List<String>, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.resolve(uris)
      return
    }
    val originals = mutableListOf<String>()
    val ungated = mutableListOf<String>()
    val contentUris = mutableListOf<Uri>()
    for (uriString in uris) {
      val uri = Uri.parse(uriString)
      when {
        uri.scheme == null || uri.scheme == "file" -> {
          val file = try {
            fileFor(uriString)
          } catch (_: CodedException) {
            continue
          }
          if (isAppOwned(file)) {
            originals.add(uriString)
            ungated.add(uriString)
            continue
          }
          val contentUri = resolveContentUri(uriString) ?: continue
          originals.add(uriString)
          contentUris.add(contentUri)
        }
        uri.scheme == ContentResolver.SCHEME_CONTENT -> {
          originals.add(uriString)
          contentUris.add(uri)
        }
      }
    }
    if (contentUris.isEmpty() || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(originals)
      return
    }
    if (writeAccessPromise != null) throw PendingWriteAccessException()
    val activity = appContext.throwingActivity as? Activity ?: throw NoActivityException()
    val pendingIntent = MediaStore.createWriteRequest(contentResolver(), contentUris)
    writeAccessPromise = promise
    pendingUris = originals
    pendingUngatedUris = ungated
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
    if (uri.scheme == ContentResolver.SCHEME_CONTENT) {
      return writeContentAtomically(uriString, uri, fields, artworkUri)
    }
    if (uri.scheme != null && uri.scheme != "file") throw UnsupportedFormatException(uriString)
    val target = fileFor(uriString)
    if (isAppOwned(target)) return writeFileAtomically(uriString, target, fields, artworkUri)
    val contentUri = resolveContentUri(uriString) ?: throw NoWriteAccessException(uriString)
    return writeContentAtomically(uriString, contentUri, fields, artworkUri)
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
      moveOrReplace(temp, target)
      return readFromFile(target)
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw writeFailure(uriString, error)
    } finally {
      temp.delete()
    }
  }

  private fun writeContentAtomically(
    uriString: String,
    contentUri: Uri,
    fields: Map<String, Any?>,
    artworkUri: String?,
  ): Map<String, Any?> {
    val ext = resolveExtension(contentUri) ?: throw UnsupportedFormatException(uriString)
    val original = File.createTempFile("audio-tags-original-", ".$ext", cacheDir())
    val patched = File.createTempFile("audio-tags-write-", ".$ext", cacheDir())
    var opened = false
    try {
      copyContent(contentUri, original)
      original.copyTo(patched, overwrite = true)
      applyFields(uriString, patched, fields, artworkUri)
      openWriteStream(contentUri).use { output ->
        opened = true
        patched.inputStream().use { input -> input.copyTo(output) }
      }
      return readWrittenContent(contentUri, ext, patched)
    } catch (error: Exception) {
      if (!opened) {
        if (error is CodedException) throw error
        throw NoWriteAccessException(uriString, error)
      }
      val rollbackFailed = !rollbackContent(contentUri, original)
      if (rollbackFailed) throw TagWriteException(uriString, error)
      if (error is CodedException) throw error
      throw writeFailure(uriString, error)
    } finally {
      original.delete()
      patched.delete()
    }
  }

  private fun rollbackContent(contentUri: Uri, original: File): Boolean =
    try {
      openWriteStream(contentUri).use { output ->
        original.inputStream().use { input -> input.copyTo(output) }
      }
      true
    } catch (_: Exception) {
      false
    }

  private fun readWrittenContent(
    contentUri: Uri,
    ext: String,
    patched: File,
  ): Map<String, Any?> {
    val verify = File.createTempFile("audio-tags-verify-", ".$ext", cacheDir())
    try {
      copyContent(contentUri, verify)
      return readFromFile(verify)
    } catch (_: Exception) {
      return try {
        readFromFile(patched)
      } catch (_: Exception) {
        emptyMap()
      }
    } finally {
      verify.delete()
    }
  }

  private fun writeFailure(uriString: String, error: Throwable): CodedException =
    if (isPermissionFailure(error)) NoWriteAccessException(uriString, error)
    else TagWriteException(uriString, error)

  private fun applyFields(
    uriString: String,
    file: File,
    fields: Map<String, Any?>,
    artworkUri: String?,
  ) {
    val audioFile = AudioFileIO.read(file)
    val tag = audioFile.getTagAndConvertOrCreateAndSetDefault()

    setField(tag, FieldKey.TITLE, fields["title"] as? String)
    setField(tag, FieldKey.ARTIST, fields["artist"] as? String)
    setField(tag, FieldKey.ALBUM, fields["album"] as? String)
    setField(tag, FieldKey.ALBUM_ARTIST, fields["albumArtist"] as? String)
    setField(tag, FieldKey.GENRE, fields["genre"] as? String)
    setField(tag, FieldKey.TRACK, (fields["trackNumber"] as? Number)?.toInt()?.toString())
    setField(tag, FieldKey.DISC_NO, (fields["discNumber"] as? Number)?.toInt()?.toString())
    setField(tag, FieldKey.YEAR, (fields["year"] as? Number)?.toInt()?.toString())
    // jaudiotagger has no portable advisory field; the explicit flag stays cache-only.
    if (artworkUri != null) applyArtwork(uriString, tag, artworkUri)
    audioFile.commit()
  }

  private fun setField(tag: Tag, key: FieldKey, value: String?) {
    if (value == null) return
    try {
      tag.setField(key, value)
    } catch (_: KeyNotFoundException) {
    }
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
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw TagReadException(uriString, error)
    } finally {
      temp.delete()
    }
  }

  private fun snapshotFile(uriString: String): String {
    val uri = Uri.parse(uriString)
    var contentSource: Uri? = null
    val ext = when {
      uri.scheme == ContentResolver.SCHEME_CONTENT -> {
        contentSource = uri
        resolveExtension(uri) ?: throw UnsupportedFormatException(uriString)
      }
      uri.scheme == null || uri.scheme == "file" -> {
        val file = fileFor(uriString)
        if (!isAppOwned(file)) contentSource = resolveContentUri(uriString)
        extensionFor(file.name)
      }
      else -> throw UnsupportedFormatException(uriString)
    }
    if (ext !in SUPPORTED_EXTENSIONS) throw UnsupportedFormatException(uriString)
    val snapshot = File(cacheDir(), "krotify-snapshot-${System.nanoTime()}.$ext")
    try {
      if (contentSource != null) {
        copyContent(contentSource, snapshot)
      } else {
        fileFor(uriString).copyTo(snapshot, overwrite = true)
      }
      return snapshot.absolutePath
    } catch (error: CodedException) {
      snapshot.delete()
      throw error
    } catch (error: Exception) {
      snapshot.delete()
      throw writeFailure(uriString, error)
    }
  }

  private fun restoreFile(uriString: String, snapshotPath: String) {
    val snapshot = File(snapshotPath)
    if (!snapshot.exists()) {
      throw TagWriteException(uriString, IllegalStateException("Snapshot is missing: $snapshotPath"))
    }
    val uri = Uri.parse(uriString)
    if (uri.scheme == ContentResolver.SCHEME_CONTENT) {
      restoreContent(uriString, uri, snapshot)
      return
    }
    if (uri.scheme != null && uri.scheme != "file") throw UnsupportedFormatException(uriString)
    val target = fileFor(uriString)
    if (!isAppOwned(target)) {
      val contentUri = resolveContentUri(uriString) ?: throw NoWriteAccessException(uriString)
      restoreContent(uriString, contentUri, snapshot)
      return
    }
    val parent = target.parentFile ?: throw TagWriteException(uriString, null)
    val ext = extensionFor(target.name)
    val temp = File(parent, ".${target.name.substringBeforeLast('.')}.krotify-restore-${System.nanoTime()}.$ext")
    try {
      snapshot.copyTo(temp, overwrite = true)
      moveOrReplace(temp, target)
      snapshot.delete()
    } catch (error: Exception) {
      throw writeFailure(uriString, error)
    } finally {
      temp.delete()
    }
  }

  private fun restoreContent(uriString: String, contentUri: Uri, snapshot: File) {
    try {
      openWriteStream(contentUri).use { output ->
        snapshot.inputStream().use { input -> input.copyTo(output) }
      }
      snapshot.delete()
    } catch (error: Exception) {
      throw writeFailure(uriString, error)
    }
  }

  private fun resolveContentUri(uriString: String): Uri? {
    val uri = Uri.parse(uriString)
    if (uri.scheme == ContentResolver.SCHEME_CONTENT) return uri
    if (uri.scheme != null && uri.scheme != "file") return null
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
    val path = uri.path ?: return null
    val context = appContext.reactContext ?: throw NoContextException()
    val resolver = contentResolver()
    for (volume in MediaStore.getExternalVolumeNames(context)) {
      val collection = MediaStore.Audio.Media.getContentUri(volume)
      val cursor = try {
        resolver.query(
          collection,
          arrayOf(MediaStore.Audio.Media._ID),
          "_data = ?",
          arrayOf(path),
          null,
        )
      } catch (_: SecurityException) {
        null
      }
      cursor?.use {
        if (it.moveToFirst()) {
          return ContentUris.withAppendedId(collection, it.getLong(0))
        }
      }
    }
    return null
  }

  private fun isAppOwned(file: File): Boolean {
    val context = appContext.reactContext ?: throw NoContextException()
    val target = try {
      file.canonicalFile
    } catch (_: IOException) {
      file.absoluteFile
    }
    val roots = listOfNotNull(context.filesDir, context.cacheDir, context.getExternalFilesDir(null))
    return roots.any { root ->
      val base = try {
        root.canonicalPath
      } catch (_: IOException) {
        return@any false
      } catch (_: SecurityException) {
        return@any false
      }
      target.path == base || target.path.startsWith(base + File.separator)
    }
  }

  private fun moveOrReplace(source: File, target: File) {
    val sourcePath = source.toPath()
    val targetPath = target.toPath()
    try {
      Files.move(
        sourcePath,
        targetPath,
        StandardCopyOption.REPLACE_EXISTING,
        StandardCopyOption.ATOMIC_MOVE,
      )
      return
    } catch (_: AtomicMoveNotSupportedException) {
    } catch (_: UnsupportedOperationException) {
    } catch (_: FileAlreadyExistsException) {
    }
    Files.move(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING)
  }

  private fun openWriteStream(uri: Uri): OutputStream =
    contentResolver().openOutputStream(uri, "rwt")
      ?: throw NoWriteAccessException(uri.toString(), IOException("Could not open $uri for writing"))

  private fun discardSnapshot(snapshotPath: String) {
    val snapshot = File(snapshotPath).canonicalFile
    val cache = cacheDir().canonicalFile
    if (!snapshot.path.startsWith(cache.path + File.separator)) {
      throw CodedException("INVALID_SNAPSHOT", "Snapshot is outside the cache directory: $snapshotPath", null)
    }
    snapshot.delete()
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
      ?: throw IOException("Could not open $uri for reading")
    input.use { stream ->
      target.outputStream().use { output -> stream.copyTo(output) }
    }
  }

  private fun contentResolver(): ContentResolver =
    appContext.reactContext?.contentResolver ?: throw NoContextException()

  private fun cacheDir(): File =
    appContext.reactContext?.cacheDir ?: throw NoContextException()
}
