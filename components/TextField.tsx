interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  // 비워 둬도 되는 칸(예: 바꿀 때만 쓰는 새 비밀번호)은 false로 둔다.
  isRequired?: boolean;
}

export default function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  isRequired = true,
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={isRequired}
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
    </label>
  );
}
