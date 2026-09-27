import React, { useMemo } from "react";
import ReactSelect from "react-select";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
}

const AutocompleteSelect: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  defaultValue,
  className = "",
}) => {
  // defaultOption akan cocokkan value *atau* label dengan defaultValue
  const defaultOption = useMemo(() => {
    if (!defaultValue) return null;

    return (
      options.find(
        (opt) =>
          opt.value.toLowerCase() === defaultValue.toLowerCase() ||
          opt.label.toLowerCase() === defaultValue.toLowerCase()
      ) || null
    );
  }, [defaultValue, options]);

  return (
    <ReactSelect
      options={options}
      placeholder={placeholder}
      value={options.find(opt =>
        opt.value.toLowerCase() === defaultValue?.toLowerCase() ||
        opt.label.toLowerCase() === defaultValue?.toLowerCase()
      ) || null}
      onChange={(selectedOption) => {
        onChange((selectedOption as Option).value);
      }}
      className={className}
      classNamePrefix="react-select"
      styles={{
        control: (base) => ({
          ...base,
          minHeight: "44px",
          borderRadius: "0.5rem",
          boxShadow: "none",
          borderColor: "#d0d5dd",
          fontSize: "0.875rem",
        }),
        singleValue: (base) => ({
          ...base,
          fontSize: "0.875rem",
        }),
        placeholder: (base) => ({
          ...base,
          fontSize: "0.875rem",
        }),
        option: (base) => ({
          ...base,
          fontSize: "0.875rem",
        }),
      }}
    />
  );
};

export default AutocompleteSelect;
