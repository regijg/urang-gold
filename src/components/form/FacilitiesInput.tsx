import React, {
  FC,
  useState,
  useEffect,
  KeyboardEvent,
  ChangeEvent,
} from "react";

interface TagInputProps {
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  hint?: string;
  value?: string[];
  onChange?: (tags: string[]) => void; 
}

const TagInput: FC<TagInputProps> = ({
  id,
  name,
  placeholder,
  className = "",
  disabled = false,
  hint,
  value = [],
  onChange,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [tags, setTags] = useState<string[]>(value);

  useEffect(() => {
    setTags(value);
  }, [value]);

  const addTag = (tag: string) => {
    const newTag = tag.trim();
    if (newTag && !tags.includes(newTag)) {
      const updated = [...tags, newTag];
      setTags(updated);
      onChange?.(updated);
    }
  };

  const removeTag = (index: number) => {
    const updated = tags.filter((_, i) => i !== index);
    setTags(updated);
    onChange?.(updated);
  };

  const upperCaseFirst = (str: string): string =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(upperCaseFirst(inputValue));
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-theme-xs ${
          disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"
        } ${className}`}
      >
        {tags.map((tag, index) => (
          <span
            key={index}
            className="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-sm text-brand-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-brand-600 hover:text-red-500"
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          id={id}
          name={name}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-grow border-none bg-transparent focus:outline-none text-sm py-1"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
};

export default TagInput;
