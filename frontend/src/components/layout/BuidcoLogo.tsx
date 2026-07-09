import { BUIDCO_LOGO_URI } from '../../assets/buidcoLogo';

export function BuidcoLogo({ size = 44 }: { size?: number }): JSX.Element {
  return (
    <img
      src={BUIDCO_LOGO_URI}
      alt="BUIDCO"
      width={size}
      height={size}
      className="block"
      style={{ objectFit: 'contain' }}
    />
  );
}
