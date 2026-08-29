import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Box, CircularProgress, InputAdornment, TextField, Typography } from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { searchPlaces } from '../api/client';

/**
 * A location picker. The value is `{ name, lat?, lng? }` or null.
 * Selecting a suggestion attaches coordinates; free text is geocoded by the API.
 */
export default function LocationAutocomplete({ label, value, onChange, icon, placeholder }) {
  const [inputValue, setInputValue] = useState(value?.name ?? '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  // Keep the text in sync when the parent changes the value (presets, saved trips).
  useEffect(() => {
    setInputValue(value?.name ?? '');
  }, [value?.name]);

  useEffect(() => {
    const query = inputValue.trim();
    const alreadyResolved = value?.lat != null && value?.name === query;
    if (query.length < 3 || alreadyResolved) {
      setOptions([]);
      return undefined;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        setOptions(await searchPlaces(query, controller.signal));
      } catch (error) {
        if (error?.name !== 'CanceledError' && error?.name !== 'AbortError') setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  return (
    <Autocomplete
      freeSolo
      autoComplete
      includeInputInList
      filterOptions={(x) => x}
      options={options}
      loading={loading}
      value={value}
      inputValue={inputValue}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name ?? '')}
      isOptionEqualToValue={(option, current) => option?.name === current?.name}
      onInputChange={(_, text, reason) => {
        setInputValue(text);
        if (reason === 'input') onChange(text ? { name: text } : null);
        if (reason === 'clear') onChange(null);
      }}
      onChange={(_, selected) => {
        if (!selected) onChange(null);
        else if (typeof selected === 'string') onChange({ name: selected });
        else onChange({ name: selected.name, lat: selected.lat, lng: selected.lng });
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={`${key}-${option.lat}-${option.lng}`} {...rest} sx={{ alignItems: 'flex-start !important' }}>
            <PlaceOutlinedIcon fontSize="small" sx={{ mr: 1, mt: 0.25, color: 'text.secondary' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {option.name}
              </Typography>
              {option.secondary && (
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {option.secondary}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  {icon}
                </InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
