import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export function AnthropicIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Anthropic Claude logo - stylized 'A' mark */}
      <path
        d="M14.5 3L21 21h-3.5L14 15.5 10.5 21H7l6.5-18h1z"
        fill="currentColor"
      />
      <path
        d="M9.5 3L3 21h3.5L10 11l-0.5-8z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

export function OpenAIIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* OpenAI logo - simplified hexagonal mark */}
      <path
        d="M21.73 11.19a3.31 3.31 0 0 0-.46-3.43 3.32 3.32 0 0 0-2.97-1.48 3.31 3.31 0 0 0-2.47-4.43 3.31 3.31 0 0 0-3.96.97 3.31 3.31 0 0 0-5.43 1.48 3.31 3.31 0 0 0-1.48 2.97 3.31 3.31 0 0 0 .46 3.43 3.32 3.32 0 0 0 2.97 1.48 3.31 3.31 0 0 0 2.47 4.43 3.31 3.31 0 0 0 3.96-.97 3.31 3.31 0 0 0 5.43-1.48 3.31 3.31 0 0 0 1.48-2.97z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function GeminiIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Google Gemini sparkle/star logo */}
      <path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill="currentColor"
      />
      <path
        d="M18 14L18.8 16.8L21.5 17.5L18.8 18.2L18 21L17.2 18.2L14.5 17.5L17.2 16.8L18 14Z"
        fill="currentColor"
        opacity="0.7"
      />
      <path
        d="M6 3L6.5 5L8.5 5.5L6.5 6L6 8L5.5 6L3.5 5.5L5.5 5L6 3Z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

export function ZaiIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6 6h12l-8 6h8v2H6l8-6H6V6z"
        fill="currentColor"
      />
      <rect x="5" y="18" width="14" height="2" fill="currentColor" />
    </svg>
  );
}

export function OllamaIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Simplified llama head */}
      <path
        d="M8 6c0-1 .5-2 2-2s2 1 2 2v2h2V6c0-1 .5-2 2-2s2 1 2 2v3c0 2-1 3-2 4v3c0 2-1 3-3 3s-3-1-3-3v-3c-1-1-2-2-2-4V6z"
        fill="currentColor"
      />
      <circle cx="10" cy="8" r="1" fill="white" />
      <circle cx="14" cy="8" r="1" fill="white" />
    </svg>
  );
}

export function DeepSeekIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* DeepSeek logo - layered squares suggesting depth */}
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
      <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

export function MiniMaxIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* MiniMax logo - stylized double 'M' */}
      <path
        d="M3 8v10h2V11l3 4 3-4v7h2V8l-4 5-4-5z"
        fill="currentColor"
      />
      <path
        d="M14 8v10h2V11l3 4 3-4v7h2V8l-4 5-4-5z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

export function OpenRouterIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* OpenRouter logo - router/network hub with radiating connections */}
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="5" cy="5" r="1.5" fill="currentColor" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" />
      <circle cx="19" cy="19" r="1.5" fill="currentColor" />
      <path
        d="M6.5 6.5L9.5 9.5M17.5 6.5L14.5 9.5M6.5 17.5L9.5 14.5M17.5 17.5L14.5 14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
