interface LogoProps {
  variant?: "white" | "blue";
  className?: string;
}

export const Logo = ({ variant = "blue", className = "h-10" }: LogoProps) => {
  const src = variant === "white" 
    ? "https://i.postimg.cc/Lsb7MLWk/i-School-Logo-colors-white-(1).png"
    : "https://i.postimg.cc/cJg6d7WY/ischool-logo-(1).png";
  
  return (
    <img 
      src={src} 
      alt="iSchool Logo" 
      className={className}
    />
  );
};
