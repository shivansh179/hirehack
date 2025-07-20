# python_scripts/model_inference.py
import sys
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import os

class InterviewModelInference:
    def __init__(self, model_path="./final_interviewer_model"):
        """Initialize the model for inference"""
        self.device = "cpu"  # Use CPU for server deployment
        self.base_model_id = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        self.model_path = model_path
        
        # Load model and tokenizer
        self._load_model()
    
    def _load_model(self):
        """Load the fine-tuned model"""
        try:
            # Load base model
            self.base_model = AutoModelForCausalLM.from_pretrained(
                self.base_model_id,
                torch_dtype=torch.float32,
                device_map="cpu",
                low_cpu_mem_usage=True
            )
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.base_model_id)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Load fine-tuned adapter
            if os.path.exists(self.model_path):
                self.model = PeftModel.from_pretrained(self.base_model, self.model_path)
                print("✅ Fine-tuned model loaded successfully", file=sys.stderr)
            else:
                self.model = self.base_model
                print("⚠️ Using base model (fine-tuned model not found)", file=sys.stderr)
                
        except Exception as e:
            print(f"❌ Model loading error: {e}", file=sys.stderr)
            raise
    
    def generate_response(self, prompt, max_tokens=100):
        """Generate response from the model"""
        try:
            # Tokenize input
            inputs = self.tokenizer(
                prompt, 
                return_tensors="pt", 
                max_length=1024, 
                truncation=True
            )
            
            # Generate response
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=0.8,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                    repetition_penalty=1.2,
                    no_repeat_ngram_size=3
                )
            
            # Decode response
            full_response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract only the new generated part
            if "<|assistant|>" in full_response:
                response = full_response.split("<|assistant|>")[-1].strip()
            else:
                # Remove the input prompt from the response
                response = full_response.replace(prompt, "").strip()
            
            return response
            
        except Exception as e:
            print(f"Generation error: {e}", file=sys.stderr)
            return "I apologize, but I'm having trouble generating a response. Could you please rephrase your answer?"

def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        print("Usage: python model_inference.py <prompt_file>", file=sys.stderr)
        sys.exit(1)
    
    prompt_file = sys.argv[1]
    
    try:
        # Read prompt from file
        with open(prompt_file, 'r', encoding='utf-8') as f:
            prompt = f.read().strip()
        
        # Initialize model
        model = InterviewModelInference()
        
        # Generate response
        response = model.generate_response(prompt)
        
        # Output response (this goes to stdout and gets captured by Node.js)
        print(response)
        
    except FileNotFoundError:
        print(f"Error: Prompt file {prompt_file} not found", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()