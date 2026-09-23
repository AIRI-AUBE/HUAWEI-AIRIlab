package com.airilab.huawei.display;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;
import java.util.Arrays;
import java.util.Comparator;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "ImageExport")
public class ImageExportPlugin extends Plugin {
    private static final long MAX_BYTES = 50L * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private File pending;
    private String pendingMime;

    @Override
    protected void handleOnDestroy() {
        worker.shutdownNow();
        super.handleOnDestroy();
    }

    private URL checkedUrl(String value) throws Exception {
        URL url = new URL(value);
        if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo() != null) throw new IOException("INVALID_URL");
        for (InetAddress address : InetAddress.getAllByName(url.getHost())) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress()) throw new IOException("INVALID_URL");
        }
        return url;
    }

    private File download(String value) throws Exception {
        File directory = new File(getContext().getCacheDir(), "image-exports");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("STORAGE_FAILED");
        File[] previous = directory.listFiles();
        if (previous != null) {
            Arrays.sort(previous, Comparator.comparingLong(File::lastModified).reversed());
            for (int i = 0; i < previous.length; i++) {
                if (i >= 4 || System.currentTimeMillis() - previous[i].lastModified() > 86400000) previous[i].delete();
            }
        }
        URL url = checkedUrl(value);
        File temporary = File.createTempFile("result-", ".download", directory);
        boolean complete = false;
        long deadline = System.currentTimeMillis() + 120000;
        try {
            for (int redirects = 0; redirects <= 5; redirects++) {
                HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(20000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "image/png,image/jpeg,image/webp");
                try {
                    int status = connection.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String location = connection.getHeaderField("Location");
                        if (location == null) throw new IOException("DOWNLOAD_FAILED");
                        url = checkedUrl(new URL(url, location).toString());
                        continue;
                    }
                    if (status != 200) throw new IOException("DOWNLOAD_FAILED");
                    if (connection.getContentLengthLong() > MAX_BYTES) throw new IOException("SIZE_LIMIT");
                    try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(temporary)) {
                        byte[] buffer = new byte[65536];
                        long size = 0;
                        int count;
                        while ((count = input.read(buffer)) != -1) {
                            size += count;
                            if (size > MAX_BYTES) throw new IOException("SIZE_LIMIT");
                            if (System.currentTimeMillis() > deadline || Thread.currentThread().isInterrupted()) throw new IOException("DOWNLOAD_FAILED");
                            output.write(buffer, 0, count);
                        }
                    }
                    BitmapFactory.Options options = new BitmapFactory.Options();
                    options.inJustDecodeBounds = true;
                    BitmapFactory.decodeFile(temporary.getAbsolutePath(), options);
                    String mime = options.outMimeType;
                    if (options.outWidth <= 0 || options.outHeight <= 0 || !("image/png".equals(mime) || "image/jpeg".equals(mime) || "image/webp".equals(mime))) throw new IOException("INVALID_IMAGE");
                    String extension = "image/png".equals(mime) ? ".png" : "image/webp".equals(mime) ? ".webp" : ".jpg";
                    File result = new File(directory, "AIRI-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6) + extension);
                    if (!temporary.renameTo(result)) throw new IOException("STORAGE_FAILED");
                    pendingMime = mime;
                    complete = true;
                    return result;
                } finally { connection.disconnect(); }
            }
            throw new IOException("DOWNLOAD_FAILED");
        } finally { if (!complete) temporary.delete(); }
    }

    @PluginMethod
    public void exportImage(PluginCall call) {
        String action = call.getString("action");
        if (!("save".equals(action) || "share".equals(action))) { call.reject("INVALID_ACTION"); return; }
        if (!busy.compareAndSet(false, true)) { call.reject("BUSY"); return; }
        worker.execute(() -> {
            try {
                pending = download(call.getString("url", ""));
                getActivity().runOnUiThread(() -> {
                    try {
                        if ("save".equals(action)) {
                            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                            intent.addCategory(Intent.CATEGORY_OPENABLE);
                            intent.setType(pendingMime);
                            intent.putExtra(Intent.EXTRA_TITLE, pending.getName());
                            startActivityForResult(call, intent, "saved");
                        } else {
                            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", pending);
                            Intent intent = new Intent(Intent.ACTION_SEND);
                            intent.setType(pendingMime);
                            intent.putExtra(Intent.EXTRA_STREAM, uri);
                            intent.setClipData(ClipData.newRawUri("AIRI", uri));
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            getActivity().startActivity(Intent.createChooser(intent, null));
                            resolve(call, "shareOpened", pending.getName());
                            // Retain shared files temporarily so the recipient can finish reading.
                            pending = null;
                            busy.set(false);
                        }
                    } catch (Exception error) { fail(call, error); }
                });
            } catch (Exception error) { fail(call, error); }
        });
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) { cleanup(); return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            resolve(call, "cancelled", ""); cleanup(); return;
        }
        Uri target = result.getData().getData();
        worker.execute(() -> {
            try {
                if (pending == null) throw new IOException("DOWNLOAD_FAILED");
                try (InputStream input = new FileInputStream(pending); OutputStream output = getContext().getContentResolver().openOutputStream(target, "w")) {
                    if (output == null) throw new IOException("STORAGE_FAILED");
                    byte[] buffer = new byte[65536]; int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                }
                String savedName = pending.getName();
                try (Cursor cursor = getContext().getContentResolver().query(target, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst() && cursor.getString(0) != null) savedName = cursor.getString(0);
                } catch (Exception ignored) { }
                resolve(call, "saved", savedName);
                cleanup();
            } catch (Exception error) {
                // Only remove the newly created, incomplete document on failure.
                try { DocumentsContract.deleteDocument(getContext().getContentResolver(), target); } catch (Exception ignored) { }
                fail(call, error);
            }
        });
    }

    private void resolve(PluginCall call, String status, String filename) {
        JSObject value = new JSObject(); value.put("status", status); value.put("filename", filename); call.resolve(value);
    }
    private void cleanup() { if (pending != null) pending.delete(); pending = null; busy.set(false); }
    private void fail(PluginCall call, Exception error) {
        cleanup();
        String code = "SIZE_LIMIT".equals(error.getMessage()) ? "SIZE_LIMIT" : "EXPORT_FAILED";
        call.reject(code, code);
    }
}
