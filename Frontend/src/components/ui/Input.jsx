import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const Input = React.forwardRef(({ 
  className, 
  type = 'text',
  icon: Icon,
  error,
  ...props 
}, ref) => {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
      )}
      <motion.input
        ref={ref}
        type={type}
        className={cn(
          "block w-full rounded-lg border bg-gray-800 text-white placeholder-gray-400 transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          Icon ? "pl-10 pr-3 py-3" : "px-3 py-3",
          error ? "border-red-500 focus:ring-red-500" : "border-gray-700",
          className
        )}
        whileFocus={{ scale: 1.01 }}
        {...props}
      />
      {error && (
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 text-sm text-red-500"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;