import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useNetworkLogger } from "../context/NetworkLoggerContext";
import { useTheme } from "../theme";
import type { MockUrlMatchType, NetworkMock } from "../types";

export interface MockPrefill {
  urlPattern: string;
  method: string;
  status: string;
  responseBody: string;
  matchType?: MockUrlMatchType;
  /** Delay in milliseconds. Converted to seconds for the delay field display. */
  delay?: number;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const MATCH_TYPES: { value: MockUrlMatchType; label: string; hint: string }[] =
  [
    {
      value: "contains",
      label: "Contains",
      hint: "Match any URL containing this substring",
    },
    { value: "exact", label: "Exact", hint: "Full URL must match exactly" },
    { value: "regex", label: "Regex", hint: "Treat pattern as a RegExp" },
  ];

/**
 * Replace typographic/smart characters that iOS/macOS keyboards and clipboard
 * paste silently into text fields, causing otherwise-correct JSON to fail parsing.
 *
 * Handled substitutions:
 *   - Mac/iOS smart double quotes  \u201C \u201D \u201E \u201F \u00AB \u00BB  →  "
 *   - Mac/iOS smart single quotes  \u2018 \u2019 \u2039 \u203A               →  '
 *   - Non-breaking space           \u00A0                                    →  (space)
 *   - Unicode line/para separator  \u2028 \u2029  →  \n (invalid raw in JSON)
 */
const SMART_CHAR_RE =
  /[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2018\u2019\u2039\u203A\u00A0\u2028\u2029]/g;
const SMART_CHAR_MAP: Record<string, string> = {
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u201F": '"',
  "\u00AB": '"',
  "\u00BB": '"',
  "\u2018": "'",
  "\u2019": "'",
  "\u2039": "'",
  "\u203A": "'",
  "\u00A0": " ",
  "\u2028": "\n",
  "\u2029": "\n",
};
const sanitizeBodyInput = (text: string): string =>
  text.replace(SMART_CHAR_RE, (ch) => SMART_CHAR_MAP[ch] ?? ch);

const prettyPrint = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      const result = JSON.stringify(value, null, 2);
      return typeof result === "string" ? result : "";
    } catch {
      return "";
    }
  }
  const str = typeof value === "string" ? value : String(value);
  if (!str.trim()) return str;
  try {
    const result = JSON.stringify(JSON.parse(str), null, 2);
    return typeof result === "string" ? result : str;
  } catch {
    return str;
  }
};

type JsonStatus = "valid" | "invalid" | "plain" | "empty";

/** Returns the JSON validity of a response body string. */
const getJsonStatus = (value: string): JsonStatus => {
  const trimmed = value.trim();
  if (!trimmed) return "empty";
  // Only lint if it looks like intended JSON (starts with { or [ or ")
  if (trimmed[0] !== "{" && trimmed[0] !== "[" && trimmed[0] !== '"')
    return "plain";
  try {
    JSON.parse(trimmed);
    return "valid";
  } catch {
    return "invalid";
  }
};

/**
 * Returns a short human-readable hint describing the most likely cause of a
 * JSON parse failure so the badge can show something more helpful than just
 * "✗ Invalid JSON".
 */
const getJsonHint = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed[0] !== "{" && trimmed[0] !== "[" && trimmed[0] !== '"')
    return undefined;
  try {
    JSON.parse(trimmed);
    return undefined; // valid — no hint needed
  } catch {
    // Trailing comma before a closing bracket/brace: {"a":1,}
    if (/,\s*[}\]]/.test(trimmed)) return "Trailing comma";
    // Single-quoted key or value: {'key': …} or …: 'value'
    if (/'[^']*'\s*:|:\s*'[^']*'/.test(trimmed)) return "Use double quotes";
    // Unquoted object key: {key: "value"}
    if (/^\s*\{[^{]*(?:^|[{,])\s*[a-zA-Z_$][\w$]*\s*:/.test(trimmed) &&
        !/'"[^"]*"\s*:/.test(trimmed)) return "Keys must be quoted";
    return undefined;
  }
};

interface FieldErrors {
  url?: string;
  status?: string;
  body?: string;
  delay?: string;
}

const validateUrl = (
  value: string,
  matchType: MockUrlMatchType,
): string | undefined => {
  if (!value.trim()) return "URL pattern is required.";
  if (matchType === "regex") {
    try {
      // eslint-disable-next-line no-new
      new RegExp(value.trim());
    } catch {
      return "Invalid regular expression.";
    }
  }
  return undefined;
};

const validateStatus = (value: string): string | undefined => {
  if (!value.trim()) return "Status code is required.";
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return "Status code must be a number.";
  if (parsed < 100 || parsed > 599)
    return "Status code must be between 100 and 599.";
  return undefined;
};

const validateDelay = (value: string): string | undefined => {
  if (!value.trim()) return undefined; // optional field
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return "Delay must be a positive number.";
  if (parsed > 60) return "Maximum delay is 60 seconds.";
  return undefined;
};

const validateBody = (value: string): string | undefined => {
  if (!value.trim()) return "Response body is required.";
  return undefined;
};

interface MethodPickerProps {
  selected: string;
  onSelect: (method: string) => void;
}

const MethodPicker = ({ selected, onSelect }: MethodPickerProps) => {
  const theme = useTheme();
  return (
    <View style={styles.methodRow}>
      {METHODS.map((m) => (
        <TouchableOpacity
          key={m}
          style={[
            styles.chip,
            { borderColor: theme.border },
            selected === m && {
              backgroundColor: theme.primary,
              borderColor: theme.primary,
            },
          ]}
          onPress={() => onSelect(m)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Select method ${m}`}
        >
          <Text
            style={[
              styles.chipText,
              { color: selected === m ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            {m}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

interface MatchTypePickerProps {
  selected: MockUrlMatchType;
  onSelect: (t: MockUrlMatchType) => void;
}

const MatchTypePicker = ({ selected, onSelect }: MatchTypePickerProps) => {
  const theme = useTheme();
  return (
    <View style={styles.methodRow}>
      {MATCH_TYPES.map(({ value, label }) => (
        <TouchableOpacity
          key={value}
          style={[
            styles.chip,
            { borderColor: theme.border },
            selected === value && {
              backgroundColor: theme.primary,
              borderColor: theme.primary,
            },
          ]}
          onPress={() => onSelect(value)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Match type ${label}`}
        >
          <Text
            style={[
              styles.chipText,
              { color: selected === value ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

interface FieldErrorProps {
  message?: string;
}

const FieldError = ({ message }: FieldErrorProps) =>
  message ? (
    <Text style={styles.fieldError} accessibilityRole="alert">
      ⚠ {message}
    </Text>
  ) : null;

interface JsonStatusBadgeProps {
  status: JsonStatus;
  hint?: string;
}

const JsonStatusBadge = ({ status, hint }: JsonStatusBadgeProps) => {
  if (status === "empty" || status === "plain") return null;
  const label =
    status === "valid"
      ? "✓ Valid JSON"
      : hint
      ? `✗ ${hint}`
      : "✗ Invalid JSON";
  return (
    <View
      style={[
        styles.jsonBadge,
        status === "valid" ? styles.jsonBadgeValid : styles.jsonBadgeInvalid,
      ]}
    >
      <Text
        style={[
          styles.jsonBadgeText,
          status === "valid"
            ? styles.jsonBadgeTextValid
            : styles.jsonBadgeTextInvalid,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

interface Props {
  prefill?: MockPrefill;
  onPrefillConsumed?: () => void;
  /** Called after a mock rule is successfully saved. Use this to navigate to the Mocks list tab. */
  onSaved?: () => void;
  /** ID of the mock being edited. When provided, the editor operates in edit mode. */
  editId?: string;
  /**
   * Callback for update mode. Called with the mock ID and the updated fields.
   * Only used when editId is provided.
   */
  onUpdate?: (id: string, patch: Partial<NetworkMock>) => void;
}

export const MockEditor = ({ prefill, onPrefillConsumed, onSaved, editId, onUpdate }: Props) => {
  const { dispatch } = useNetworkLogger();
  const theme = useTheme();

  const [urlPattern, setUrlPattern] = useState("");
  const [matchType, setMatchType] = useState<MockUrlMatchType>("contains");
  const [method, setMethod] = useState("GET");
  const [statusCode, setStatusCode] = useState("200");
  const [responseBody, setResponseBody] = useState("");
  const [delaySec, setDelaySec] = useState(""); // empty = no delay

  const isEditing = !!editId;
  const title = isEditing ? "Edit Mock Rule" : "New Mock Rule";

  // Per-field validation errors — only shown after the field has been touched
  // (blurred at least once) or after a failed save attempt.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Tracks which fields have been blurred so we don't show errors pre-emptively.
  const [touched, setTouched] = useState<Record<keyof FieldErrors, boolean>>({
    url: false,
    status: false,
    body: false,
    delay: false,
  });

  // Live JSON status + hint for the response body editor.
  const jsonStatus = getJsonStatus(responseBody);
  const jsonHint =
    jsonStatus === "invalid" ? getJsonHint(responseBody) : undefined;

  useEffect(() => {
    if (!prefill) return;
    setUrlPattern(prefill.urlPattern);
    setMatchType(prefill.matchType ?? "contains");
    setMethod(METHODS.includes(prefill.method) ? prefill.method : "GET");
    setStatusCode(prefill.status || "200");
    setResponseBody(prettyPrint(prefill.responseBody));
    // Convert stored milliseconds → seconds string for the delay field (empty = no delay).
    setDelaySec(
      prefill.delay && prefill.delay > 0
        ? String(prefill.delay / 1000)
        : ''
    );
    setFieldErrors({});
    setTouched({ url: false, status: false, body: false, delay: false });
    onPrefillConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill object reference is the only trigger
  }, [prefill]);

  const markTouched = (field: keyof FieldErrors) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handleUrlBlur = () => {
    markTouched("url");
    setFieldErrors((prev) => ({
      ...prev,
      url: validateUrl(urlPattern, matchType),
    }));
  };

  const handleStatusBlur = () => {
    markTouched("status");
    setFieldErrors((prev) => ({ ...prev, status: validateStatus(statusCode) }));
  };

  const handleBodyBlur = () => {
    markTouched("body");
    setFieldErrors((prev) => ({ ...prev, body: validateBody(responseBody) }));
  };

  const handleDelayBlur = () => {
    markTouched("delay");
    setFieldErrors((prev) => ({ ...prev, delay: validateDelay(delaySec) }));
  };

  const handleSave = () => {
    // Validate all fields and reveal any that weren't touched yet.
    const errors: FieldErrors = {
      url: validateUrl(urlPattern, matchType),
      status: validateStatus(statusCode),
      body: validateBody(responseBody),
      delay: validateDelay(delaySec),
    };
    setFieldErrors(errors);
    setTouched({ url: true, status: true, body: true, delay: true });

    if (errors.url || errors.status || errors.body || errors.delay) return;

    // statusCode is validated to be a valid integer above — parseInt is safe here.
    // delaySec is optional; convert seconds → milliseconds (0 means no delay).
    const delayMs = delaySec.trim()
      ? Math.round(parseFloat(delaySec) * 1000)
      : undefined;

    if (isEditing && onUpdate) {
      // Update existing mock.
      // Always include delay (even as undefined) so that clearing the field
      // actually removes an existing delay rather than silently preserving it.
      onUpdate(editId, {
        urlPattern: urlPattern.trim(),
        matchType,
        method,
        status: parseInt(statusCode, 10),
        responseBody: responseBody.trim(),
        delay: delayMs && delayMs > 0 ? delayMs : undefined,
      });
      onSaved?.();
      return;
    }

    // Create new mock
    const mock: NetworkMock = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, // NOSONAR
      urlPattern: urlPattern.trim(),
      matchType,
      method,
      status: parseInt(statusCode, 10),
      responseBody: responseBody.trim(),
      enabled: true,
      ...(delayMs !== undefined && delayMs > 0 && { delay: delayMs }),
    };

    dispatch({ type: "ADD_MOCK", payload: mock });
    // Reset form
    setUrlPattern("");
    setMethod("GET");
    setStatusCode("200");
    setResponseBody("");
    setDelaySec("");
    setFieldErrors({});
    setTouched({ url: false, status: false, body: false, delay: false });
    setMatchType("contains");
    onSaved?.();
  };

  const urlHasError = touched.url && !!fieldErrors.url;
  const statusHasError = touched.status && !!fieldErrors.status;
  const bodyHasError = touched.body && !!fieldErrors.body;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { backgroundColor: theme.surface },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {title}
          </Text>

          {/* ── URL Pattern ── */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            URL PATTERN
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surface },
              urlHasError ? styles.inputError : { borderColor: theme.border },
            ]}
            value={urlPattern}
            onChangeText={(v) => {
              setUrlPattern(v);
              if (touched.url) {
                setFieldErrors((prev) => ({
                  ...prev,
                  url: validateUrl(v, matchType),
                }));
              }
            }}
            onBlur={handleUrlBlur}
            placeholder="/api/v1/endpoint"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="URL pattern"
            accessibilityHint={`Enter a URL pattern to match (${
              matchType === "contains"
                ? "substring"
                : matchType === "exact"
                  ? "full URL"
                  : "regular expression"
            })`}
          />
          <FieldError message={touched.url ? fieldErrors.url : undefined} />

          {/* ── Match Type ── */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            MATCH TYPE
          </Text>
          <MatchTypePicker
            selected={matchType}
            onSelect={(t) => {
              setMatchType(t);
              // Re-validate URL immediately when match type changes (regex validity)
              if (touched.url) {
                setFieldErrors((prev) => ({
                  ...prev,
                  url: validateUrl(urlPattern, t),
                }));
              }
            }}
          />
          <Text style={[styles.matchTypeHint, { color: theme.textSecondary }]}>
            {MATCH_TYPES.find((m) => m.value === matchType)?.hint}
          </Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            METHOD
          </Text>
          <MethodPicker selected={method} onSelect={setMethod} />

          {/* ── Status Code ── */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            STATUS CODE
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surface },
              statusHasError
                ? styles.inputError
                : { borderColor: theme.border },
            ]}
            value={statusCode}
            onChangeText={(v) => {
              setStatusCode(v);
              if (touched.status) {
                setFieldErrors((prev) => ({
                  ...prev,
                  status: validateStatus(v),
                }));
              }
            }}
            onBlur={handleStatusBlur}
            placeholder="200"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            accessibilityLabel="Status code"
            accessibilityHint="HTTP status code between 100 and 599"
          />
          <FieldError
            message={touched.status ? fieldErrors.status : undefined}
          />

          {/* ── Response Body ── */}
          <View style={styles.bodyLabelRow}>
            <Text
              style={[
                styles.label,
                { color: theme.textSecondary, marginTop: 0 },
              ]}
            >
              RESPONSE BODY
            </Text>
            <View style={styles.bodyLabelRight}>
              <JsonStatusBadge status={jsonStatus} hint={jsonHint} />
              <TouchableOpacity
                onPress={() =>
                setResponseBody((v) => prettyPrint(sanitizeBodyInput(v)))
              }
                style={[styles.formatButton, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Format JSON"
              >
                <Text
                  style={[
                    styles.formatButtonText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Format
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={[
              styles.codeInputWrapper,
              bodyHasError
                ? styles.codeInputWrapperError
                : { borderColor: theme.border },
            ]}
          >
            <TextInput
              style={styles.codeInput}
              value={responseBody}
              onChangeText={(v) => {
                const sanitized = sanitizeBodyInput(v);
                setResponseBody(sanitized);
                if (touched.body) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    body: validateBody(sanitized),
                  }));
                }
              }}
              onBlur={handleBodyBlur}
              placeholder={'{\n  "key": "value"\n}'}
              placeholderTextColor="#4B5563"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
              accessibilityLabel="Response body"
              accessibilityHint="JSON or plain-text response body"
            />
          </View>
          <FieldError message={touched.body ? fieldErrors.body : undefined} />

          {/* ── Response Delay (optional) ── */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            RESPONSE DELAY (optional)
          </Text>
          <View style={styles.delayRow}>
            <TextInput
              style={[
                styles.input,
                styles.delayInput,
                { color: theme.text, backgroundColor: theme.surface },
                touched.delay && fieldErrors.delay
                  ? styles.inputError
                  : { borderColor: theme.border },
              ]}
              value={delaySec}
              onChangeText={(v) => {
                setDelaySec(v);
                if (touched.delay) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    delay: validateDelay(v),
                  }));
                }
              }}
              onBlur={handleDelayBlur}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              accessibilityLabel="Response delay in seconds"
              accessibilityHint="Leave empty for no delay. Maximum 60 seconds."
            />
            <Text style={[styles.delayUnit, { color: theme.textSecondary }]}>
              seconds
            </Text>
          </View>
          <Text style={[styles.delayHint, { color: theme.textSecondary }]}>
            Simulates slow responses or timeout scenarios. Leave empty for
            instant reply.
          </Text>
          <FieldError message={touched.delay ? fieldErrors.delay : undefined} />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Save mock rule"
          >
            <Text style={styles.saveButtonText}>Save Mock</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { borderRadius: 12, padding: 16, gap: 10 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    paddingHorizontal: 16,
    alignItems: "center",
    textAlign: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginTop: 4,
  },
  inputError: {
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  matchTypeHint: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
    lineHeight: 16,
  },
  bodyLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  bodyLabelRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  formatButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  formatButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  codeInputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    marginTop: 4,
    overflow: "hidden",
  },
  codeInputWrapperError: {
    borderWidth: 1,
    borderColor: "#DC2626",
    borderRadius: 8,
    backgroundColor: "#0F172A",
    marginTop: 4,
    overflow: "hidden",
  },
  codeInput: {
    color: "#E2E8F0",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    minHeight: 140,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldError: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 3,
    marginLeft: 2,
  },
  jsonBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  jsonBadgeValid: {
    backgroundColor: "#DCFCE7",
  },
  jsonBadgeInvalid: {
    backgroundColor: "#FEE2E2",
  },
  jsonBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  jsonBadgeTextValid: {
    color: "#15803D",
  },
  jsonBadgeTextInvalid: {
    color: "#DC2626",
  },
  delayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  delayInput: {
    flex: 1,
    marginTop: 0,
  },
  delayUnit: {
    fontSize: 13,
    fontWeight: "500",
  },
  delayHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginLeft: 2,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
