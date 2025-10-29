import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ message = 'Loading...', progress = null }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-12 h-12 text-blue-500" />
      </motion.div>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 text-lg font-semibold text-gray-300"
      >
        {message}
      </motion.p>

      {progress !== null && (
        <div className="mt-4 w-64">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
            />
          </div>
          <p className="mt-2 text-sm text-gray-400 text-center">{progress}%</p>
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;