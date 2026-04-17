import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../theme';
import type { MockPreset, MockPresetVariant } from '../types';

/**
 * Validation result for a preset file.
 */
interface ValidationResult {
  valid: boolean;
  presets?: MockPreset[];
  error?: string;
}

/**
 * Validate that parsed JSON matches MockPreset[] format.
 * Returns ValidationResult with either valid presets or an error message.
 */
function validatePresets(data: unknown): ValidationResult {
  // Check if it's an array
  if (!Array.isArray(data)) {
    return { valid: false, error: 'Expected an array of presets, but got a non-array value.' };
  }

  // Empty array is technically valid
  if (data.length === 0) {
    return { valid: true, presets: [] };
  }

  const presets: MockPreset[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // Check if it's an object
    if (typeof item !== 'object' || item === null) {
      return {
        valid: false,
        error: `Preset at index ${i} is not a valid object.`,
      };
    }

    const preset = item as Record<string, unknown>;

    // Check required fields
    if (typeof preset.urlPattern !== 'string') {
      return {
        valid: false,
        error: `Preset at index ${i} is missing required field 'urlPattern' (string).`,
      };
    }

    if (typeof preset.method !== 'string') {
      return {
        valid: false,
        error: `Preset at index ${i} is required field 'method' (string).`,
      };
    }

    // Validate matchType if provided
    if (preset.matchType !== undefined) {
      const validMatchTypes = ['contains', 'exact', 'regex'];
      if (!validMatchTypes.includes(preset.matchType as string)) {
        return {
          valid: false,
          error: `Preset at index ${i}: 'matchType' must be one of 'contains', 'exact', or 'regex'.`,
        };
      }
    }

    // Validate status if provided (must be number between 100-599)
    if (preset.status !== undefined) {
      if (typeof preset.status !== 'number' || preset.status < 100 || preset.status > 599) {
        return {
          valid: false,
          error: `Preset at index ${i}: 'status' must be a number between 100 and 599.`,
        };
      }
    }

    // Validate enabled if provided
    if (preset.enabled !== undefined && typeof preset.enabled !== 'boolean') {
      return {
        valid: false,
        error: `Preset at index ${i}: 'enabled' must be a boolean.`,
      };
    }

    // Validate delay if provided
    if (preset.delay !== undefined) {
      if (typeof preset.delay !== 'number' || preset.delay < 0) {
        return {
          valid: false,
          error: `Preset at index ${i}: 'delay' must be a non-negative number.`,
        };
      }
    }

    // Validate variants if provided
    if (preset.variants !== undefined) {
      if (!Array.isArray(preset.variants)) {
        return {
          valid: false,
          error: `Preset at index ${i}: 'variants' must be an array.`,
        };
      }

      for (let j = 0; j < preset.variants.length; j++) {
        const variant = preset.variants[j] as Record<string, unknown>;

        if (typeof variant.name !== 'string') {
          return {
            valid: false,
            error: `Preset at index ${i}, variant ${j}: missing required field 'name' (string).`,
          };
        }

        if (typeof variant.status !== 'number' || variant.status < 100 || variant.status > 599) {
          return {
            valid: false,
            error: `Preset at index ${i}, variant ${j}: 'status' must be a number between 100 and 599.`,
          };
        }

        if (typeof variant.responseBody !== 'string') {
          return {
            valid: false,
            error: `Preset at index ${i}, variant ${j}: missing required field 'responseBody' (string).`,
          };
        }

        // Validate optional delay
        if (variant.delay !== undefined) {
          if (typeof variant.delay !== 'number' || variant.delay < 0) {
            return {
              valid: false,
              error: `Preset at index ${i}, variant ${j}: 'delay' must be a non-negative number.`,
            };
          }
        }

        // Validate optional responseHeaders
        if (variant.responseHeaders !== undefined) {
          if (typeof variant.responseHeaders !== 'object' || variant.responseHeaders === null) {
            return {
              valid: false,
              error: `Preset at index ${i}, variant ${j}: 'responseHeaders' must be an object.`,
            };
          }
        }
      }
    }

    // Validate defaultVariant if provided
    if (preset.defaultVariant !== undefined && typeof preset.defaultVariant !== 'string') {
      return {
        valid: false,
        error: `Preset at index ${i}: 'defaultVariant' must be a string.`,
      };
    }

    // Build the validated preset
    const validatedPreset: MockPreset = {
      urlPattern: preset.urlPattern as string,
      method: preset.method as string,
      matchType: preset.matchType as MockPreset['matchType'],
      status: preset.status as number | undefined,
      responseBody: preset.responseBody as string | undefined,
      responseHeaders: preset.responseHeaders as MockPreset['responseHeaders'],
      enabled: preset.enabled as boolean | undefined,
      delay: preset.delay as number | undefined,
      defaultVariant: preset.defaultVariant as string | undefined,
    };

    if (preset.variants) {
      validatedPreset.variants = (preset.variants as unknown[]).map((v) => {
        const variant = v as Record<string, unknown>;
        const validatedVariant: MockPresetVariant = {
          name: variant.name as string,
          status: variant.status as number,
          responseBody: variant.responseBody as string,
          responseHeaders: variant.responseHeaders as MockPresetVariant['responseHeaders'],
          delay: variant.delay as number | undefined,
        };
        return validatedVariant;
      });
    }

    presets.push(validatedPreset);
  }

  return { valid: true, presets };
}

/**
 * Process imported JSON content - parse and validate, then update state and show alert.
 */
function processImportedContent(
  content: string,
  setIsLoading: (loading: boolean) => void,
  onImport?: (presets: MockPreset[]) => void
): Promise<void> {
  return new Promise((resolve) => {
    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      Alert.alert('Invalid JSON', 'The pasted text does not contain valid JSON.');
      setIsLoading(false);
      resolve();
      return;
    }

    // Validate structure
    const result = validatePresets(parsed);

    if (!result.valid || !result.presets) {
      Alert.alert('Invalid Preset Format', result.error ?? 'Unknown validation error.');
      setIsLoading(false);
      resolve();
      return;
    }

    // Success - call the optional onImport callback with the validated presets
    if (onImport) {
      onImport(result.presets);
    }

    Alert.alert(
      'Presets Imported',
      `Successfully imported ${result.presets.length} preset(s).\n\n${result.presets
        .slice(0, 3)
        .map((p) => `• ${p.method} ${p.urlPattern}`)
        .join('\n')}${result.presets.length > 3 ? `\n...and ${result.presets.length - 3} more` : ''}`,
      [{ text: 'OK' }]
    );

    setIsLoading(false);
    resolve();
  });
}

/**
 * PresetImporter component allows users to import JSON preset files via paste.
 * 
 * @param onImport - Optional callback invoked with validated MockPreset[] after successful import
 * 
 * @example
 * ```tsx
 * <PresetImporter onImport={(presets) => dispatch({ type: 'ADD_PRESETS', payload: presets })} />
 * ```
 */
export const PresetImporter = ({ onImport }: { onImport?: (presets: MockPreset[]) => void }) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedJson, setPastedJson] = useState('');

  const handlePasteImport = async () => {
    setShowPasteModal(true);
  };

  const handlePasteSubmit = async () => {
    if (!pastedJson.trim()) {
      Alert.alert('Empty Input', 'Please paste some JSON content to import.');
      return;
    }

    setShowPasteModal(false);
    setIsLoading(true);

    try {
      await processImportedContent(pastedJson, setIsLoading, onImport);
    } catch (error) {
      Alert.alert(
        'Import Failed',
        error instanceof Error ? error.message : 'An unknown error occurred while importing.'
      );
      setIsLoading(false);
    }

    setPastedJson('');
  };

  const handlePasteCancel = () => {
    setShowPasteModal(false);
    setPastedJson('');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.importButton,
          { backgroundColor: theme.primary },
          isLoading && styles.importButtonDisabled,
        ]}
        onPress={handlePasteImport}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel="Paste JSON preset"
      >
        <Text style={styles.importButtonText}>
          {isLoading ? 'Importing...' : 'Paste JSON to Import Presets'}
        </Text>
      </TouchableOpacity>

      <View style={styles.hint}>
        <Text style={[styles.hintText, { color: theme.textSecondary }]}>
          Paste a JSON array of mock presets. Each preset should have{' '}
          <Text style={styles.hintBold}>urlPattern</Text> and{' '}
          <Text style={styles.hintBold}>method</Text> fields.
        </Text>
      </View>

      <Modal
        visible={showPasteModal}
        transparent
        animationType="fade"
        onRequestClose={handlePasteCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Paste JSON</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Paste your JSON preset array below
            </Text>
            <TextInput
              style={[
                styles.pasteInput,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
              ]}
              value={pastedJson}
              onChangeText={setPastedJson}
              placeholder='[{"urlPattern": "...", "method": "GET", ...}, ...]'
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: theme.border }]}
                onPress={handlePasteCancel}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmitButton, { backgroundColor: theme.primary }]}
                onPress={handlePasteSubmit}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  importButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 18,
  },
  hintBold: {
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  pasteInput: {
    minHeight: 200,
    maxHeight: 300,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalSubmitButton: {
    paddingVertical: 12,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});