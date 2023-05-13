import { h, JSX } from "preact";

interface IProps {
  size?: number;
}

export function IconDefaultExercise(props: IProps = {}): JSX.Element {
  const size = props.size ?? 24;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="16" fill="#D9D9D9" />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M25.5716 14.9039C24.7645 15.1393 23.9687 15.4203 23.1866 15.7469L23.1757 15.7515C22.5413 16.0162 22.1752 16.6773 22.2922 17.3471L23.4988 24.2642C23.589 24.7813 23.3914 25.3056 22.9838 25.6432C19.9371 28.1663 18 31.952 18 36.1839C18 44.6348 25.725 51.3062 34.5875 49.6987C40.2007 48.6802 44.6108 44.3261 45.6397 38.7873C46.6168 33.5285 44.5595 28.6763 40.9008 25.6451C40.4923 25.3066 40.2931 24.7825 40.3834 24.264L41.5883 17.3588C41.7061 16.6822 41.3366 16.0141 40.6953 15.7469C39.9132 15.4203 39.1174 15.1393 38.3106 14.9039C36.2521 14.3032 34.1188 14 31.941 14C29.7637 14 27.6301 14.3032 25.5716 14.9039ZM26.4243 19.7917C26.2912 19.0293 26.7795 18.2932 27.5418 18.1127C28.9733 17.7739 30.4446 17.6032 31.941 17.6032C33.4378 17.6032 34.9088 17.7739 36.3404 18.1127C37.1026 18.2932 37.591 19.0293 37.4576 19.7917L36.8452 23.3044C35.3197 22.7381 33.6668 22.4286 31.941 22.4286C30.2152 22.4286 28.5624 22.7381 27.037 23.3044L26.4243 19.7917Z"
        fill="#BCBCBC"
      />
    </svg>
  );
}