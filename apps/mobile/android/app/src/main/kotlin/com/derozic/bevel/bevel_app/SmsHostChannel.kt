package com.derozic.bevel.bevel_app

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import android.telephony.SmsMessage
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Optional Android SMS host. Agents can prompt the human on their own
 * number. This reads/sends via the telephony provider (the same inbox
 * Google Messages uses for SMS). There is no public RCS API.
 *
 * Channel: com.derozic.bevel/sms_host
 */
class SmsHostChannel(
    private val activity: Activity,
    messenger: BinaryMessenger,
) : MethodChannel.MethodCallHandler, EventChannel.StreamHandler {

    companion object {
        const val NAME = "com.derozic.bevel/sms_host"
        const val EVENTS = "com.derozic.bevel/sms_host_events"
        const val PREFS = "bevel.sms_host"
        const val KEY_ENABLED = "enabled"
        const val REQ_PERMS = 7142
        const val GOOGLE_MESSAGES = "com.google.android.apps.messaging"

        @Volatile
        var instance: SmsHostChannel? = null
            private set
    }

    private val channel = MethodChannel(messenger, NAME)
    private val events = EventChannel(messenger, EVENTS)
    private var sink: EventChannel.EventSink? = null
    private var permResult: MethodChannel.Result? = null

    init {
        instance = this
        channel.setMethodCallHandler(this)
        events.setStreamHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "status" -> result.success(status())
            "requestPermissions" -> requestPermissions(result)
            "setEnabled" -> {
                val on = call.argument<Boolean>("enabled") ?: false
                prefs().edit().putBoolean(KEY_ENABLED, on).apply()
                result.success(status())
            }
            "listRecentThreads" -> {
                val limit = call.argument<Int>("limit") ?: 40
                result.success(listRecentThreads(limit))
            }
            "searchInbox" -> {
                val q = call.argument<String>("q") ?: ""
                val limit = call.argument<Int>("limit") ?: 40
                result.success(searchInbox(q, limit))
            }
            "scanMessages" -> {
                val limit = call.argument<Int>("limit") ?: 400
                result.success(scanMessages(limit))
            }
            "send" -> {
                val address = call.argument<String>("address") ?: ""
                val body = call.argument<String>("body") ?: ""
                result.success(send(address, body))
            }
            else -> result.notImplemented()
        }
    }

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != REQ_PERMS) return
        val pending = permResult ?: return
        permResult = null
        pending.success(status())
    }

    fun emitIncoming(address: String, body: String, ts: Long) {
        activity.runOnUiThread {
            sink?.success(
                mapOf(
                    "type" to "message",
                    "payload" to mapOf(
                        "address" to address,
                        "body" to body,
                        "ts" to ts,
                        "isFromMe" to false,
                    ),
                ),
            )
        }
    }

    private fun requestPermissions(result: MethodChannel.Result) {
        val needed = arrayOf(
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS,
        )
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            result.success(status())
            return
        }
        permResult = result
        ActivityCompat.requestPermissions(activity, missing.toTypedArray(), REQ_PERMS)
    }

    private fun status(): Map<String, Any> {
        val read = has(Manifest.permission.READ_SMS)
        val send = has(Manifest.permission.SEND_SMS)
        val receive = has(Manifest.permission.RECEIVE_SMS)
        val enabled = prefs().getBoolean(KEY_ENABLED, false)
        var count = 0
        var error = ""
        if (read) {
            try {
                count = messageCount()
            } catch (e: SecurityException) {
                error = "SMS read blocked. Grant SMS permission."
            }
        }
        return mapOf(
            "platform" to "android",
            "enabled" to enabled,
            "canRead" to read,
            "canSend" to send,
            "canReceive" to receive,
            "googleMessagesInstalled" to isInstalled(GOOGLE_MESSAGES),
            "messageCount" to count,
            "ready" to (enabled && read && send),
            "error" to error,
            "rcsNote" to
                "RCS stays in Google Messages. Android does not expose a third-party RCS API.",
        )
    }

    private fun listRecentThreads(limit: Int): Map<String, Any> {
        if (!has(Manifest.permission.READ_SMS)) {
            return mapOf(
                "ok" to false,
                "threads" to emptyList<Any>(),
                "error" to "READ_SMS not granted",
            )
        }
        val capped = limit.coerceIn(1, 200)
        val seen = LinkedHashMap<String, Map<String, Any>>()
        val projection = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE,
            Telephony.Sms._ID,
        )
        activity.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            projection,
            null,
            null,
            "${Telephony.Sms.DATE} DESC",
        )?.use { cursor ->
            val iAddr = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
            val iBody = cursor.getColumnIndex(Telephony.Sms.BODY)
            val iDate = cursor.getColumnIndex(Telephony.Sms.DATE)
            val iType = cursor.getColumnIndex(Telephony.Sms.TYPE)
            val iId = cursor.getColumnIndex(Telephony.Sms._ID)
            while (cursor.moveToNext() && seen.size < capped) {
                val address = if (iAddr >= 0) cursor.getString(iAddr) ?: continue else continue
                if (seen.containsKey(address)) continue
                val type = if (iType >= 0) cursor.getInt(iType) else Telephony.Sms.MESSAGE_TYPE_INBOX
                seen[address] = mapOf(
                    "address" to address,
                    "lastBody" to ((if (iBody >= 0) cursor.getString(iBody) else "") ?: "").take(280),
                    "ts" to if (iDate >= 0) cursor.getLong(iDate) else 0L,
                    "isFromMe" to (type == Telephony.Sms.MESSAGE_TYPE_SENT ||
                        type == Telephony.Sms.MESSAGE_TYPE_OUTBOX),
                    "id" to if (iId >= 0) cursor.getLong(iId).toString() else "",
                )
            }
        }
        return mapOf("ok" to true, "threads" to seen.values.toList())
    }

    private fun searchInbox(rawQuery: String, limit: Int): Map<String, Any> {
        if (!has(Manifest.permission.READ_SMS)) {
            return mapOf("ok" to false, "messages" to emptyList<Any>(), "error" to "READ_SMS not granted")
        }
        val q = rawQuery.trim()
        if (q.length < 2) {
            return mapOf("ok" to true, "messages" to emptyList<Any>())
        }
        val capped = limit.coerceIn(1, 80)
        val like = "%${q.replace("%", "").replace("_", "")}%"
        val rows = querySms(
            selection = "${Telephony.Sms.BODY} LIKE ?",
            args = arrayOf(like),
            limit = capped,
        )
        return mapOf("ok" to true, "messages" to rows)
    }

    private fun scanMessages(limit: Int): Map<String, Any> {
        if (!has(Manifest.permission.READ_SMS)) {
            return mapOf("ok" to false, "messages" to emptyList<Any>(), "error" to "READ_SMS not granted")
        }
        val rows = querySms(selection = null, args = null, limit = limit.coerceIn(1, 800))
        return mapOf("ok" to true, "scanned" to rows.size, "messages" to rows)
    }

    private fun querySms(selection: String?, args: Array<String>?, limit: Int): List<Map<String, Any>> {
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE,
        )
        val out = ArrayList<Map<String, Any>>(limit)
        activity.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            projection,
            selection,
            args,
            "${Telephony.Sms.DATE} DESC",
        )?.use { cursor ->
            val iId = cursor.getColumnIndex(Telephony.Sms._ID)
            val iAddr = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
            val iBody = cursor.getColumnIndex(Telephony.Sms.BODY)
            val iDate = cursor.getColumnIndex(Telephony.Sms.DATE)
            val iType = cursor.getColumnIndex(Telephony.Sms.TYPE)
            while (cursor.moveToNext() && out.size < limit) {
                val type = if (iType >= 0) cursor.getInt(iType) else Telephony.Sms.MESSAGE_TYPE_INBOX
                out.add(
                    mapOf(
                        "id" to if (iId >= 0) cursor.getLong(iId).toString() else "",
                        "address" to ((if (iAddr >= 0) cursor.getString(iAddr) else "") ?: ""),
                        "body" to ((if (iBody >= 0) cursor.getString(iBody) else "") ?: ""),
                        "ts" to if (iDate >= 0) cursor.getLong(iDate) else 0L,
                        "isFromMe" to (type == Telephony.Sms.MESSAGE_TYPE_SENT ||
                            type == Telephony.Sms.MESSAGE_TYPE_OUTBOX),
                    ),
                )
            }
        }
        return out
    }

    private fun send(rawAddress: String, rawBody: String): Map<String, Any> {
        if (!has(Manifest.permission.SEND_SMS)) {
            return mapOf("ok" to false, "error" to "SEND_SMS not granted")
        }
        val address = normalizeAddress(rawAddress)
        val body = rawBody.trim()
        if (address.isEmpty()) return mapOf("ok" to false, "error" to "Address required")
        if (body.isEmpty()) return mapOf("ok" to false, "error" to "Message body required")
        if (body.length > 1500) return mapOf("ok" to false, "error" to "body too long (max 1500)")
        return try {
            val sms = smsManager()
            val parts = sms.divideMessage(body)
            if (parts.size <= 1) {
                sms.sendTextMessage(address, null, body, null, null)
            } else {
                sms.sendMultipartTextMessage(address, null, parts, null, null)
            }
            mapOf(
                "ok" to true,
                "address" to address,
                "method" to "sms",
            )
        } catch (e: Exception) {
            mapOf("ok" to false, "error" to (e.message ?: "send failed"), "address" to address)
        }
    }

    private fun smsManager(): SmsManager {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            activity.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getDefault()
        }
    }

    private fun messageCount(): Int {
        activity.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            arrayOf(Telephony.Sms._ID),
            null,
            null,
            null,
        )?.use { return it.count }
        return 0
    }

    private fun has(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(activity, permission) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun isInstalled(pkg: String): Boolean {
        return try {
            activity.packageManager.getPackageInfo(pkg, 0)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }
    }

    private fun prefs() = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun normalizeAddress(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.contains("@")) return trimmed
        val digits = trimmed.filter { it.isDigit() }
        if (trimmed.startsWith("+")) return "+$digits"
        if (digits.length == 10) return "+1$digits"
        if (digits.length == 11 && digits.startsWith("1")) return "+$digits"
        return if (digits.isEmpty()) trimmed else "+$digits"
    }

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        sink = events
    }

    override fun onCancel(arguments: Any?) {
        sink = null
    }
}

/** Incoming SMS → Flutter event sink. Does not handle RCS. */
class SmsHostReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages: Array<SmsMessage> = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) return
        val address = messages.first().displayOriginatingAddress ?: return
        val body = messages.joinToString(separator = "") { it.displayMessageBody ?: "" }
        val ts = messages.first().timestampMillis
        SmsHostChannel.instance?.emitIncoming(address, body, ts)
    }
}
