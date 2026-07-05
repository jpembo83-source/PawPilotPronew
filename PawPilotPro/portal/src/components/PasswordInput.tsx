import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = InputHTMLAttributes<HTMLInputElement>;

/**
 * Password field with a show/hide toggle, for the auth screens. Purely
 * presentational: forwards every prop (including react-hook-form's ref)
 * to the underlying input and only swaps its `type`. The toggle sits
 * inside the field with a 44px hit target.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ className = "", ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`${className} pr-12`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="press absolute right-0.5 top-1/2 -translate-y-1/2 size-11 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          {visible ? (
            <EyeOff size={18} strokeWidth={2.2} />
          ) : (
            <Eye size={18} strokeWidth={2.2} />
          )}
        </button>
      </div>
    );
  },
);
