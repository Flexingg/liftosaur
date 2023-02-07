import { h, JSX } from "preact";

interface IProps {
  size?: number;
  color?: string;
}

export function IconLink(props: IProps): JSX.Element {
  const size = props.size ?? 24;
  const color = props.color ?? "#171718";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M31.1109 9.11091C33.2587 6.96303 36.7412 6.96303 38.889 9.11091C41.0369 11.2588 41.0369 14.7412 38.889 16.8891L30.639 25.1391C28.4912 27.287 25.0087 27.287 22.8609 25.1391C21.7869 24.0651 20.0457 24.0651 18.9718 25.1391C17.8978 26.213 17.8978 27.9542 18.9718 29.0282C23.2675 33.3239 30.2324 33.3239 34.5281 29.0282L42.7781 20.7782C47.0739 16.4824 47.0739 9.51759 42.7781 5.22183C38.4824 0.926058 31.5175 0.926058 27.2218 5.22183L23.0968 9.34682C22.0228 10.4208 22.0228 12.162 23.0968 13.2359C24.1707 14.3099 25.9119 14.3099 26.9859 13.2359L31.1109 9.11091Z"
        fill={color}
      />
      <path
        d="M17.3609 22.8609C19.5088 20.713 22.9912 20.713 25.1391 22.8609C26.213 23.9349 27.9542 23.9349 29.0282 22.8609C30.1021 21.787 30.1021 20.0458 29.0282 18.9718C24.7324 14.6761 17.7676 14.6761 13.4718 18.9718L5.22182 27.2218C0.926058 31.5176 0.926059 38.4824 5.22182 42.7782C9.51759 47.0739 16.4824 47.0739 20.7782 42.7782L24.9032 38.6532C25.9771 37.5792 25.9771 35.838 24.9032 34.7641C23.8292 33.6901 22.088 33.6901 21.0141 34.7641L16.8891 38.8891C14.7412 41.037 11.2588 41.037 9.11091 38.8891C6.96303 36.7412 6.96303 33.2588 9.11091 31.1109L17.3609 22.8609Z"
        fill={color}
      />
    </svg>
  );
}